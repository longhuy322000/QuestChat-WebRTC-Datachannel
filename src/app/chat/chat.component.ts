import { Component, OnInit, NgZone, OnDestroy, HostListener, ViewChild, ElementRef, AfterViewChecked, AfterViewInit  } from '@angular/core';
import { AngularFirestore, AngularFirestoreCollection } from 'angularfire2/firestore';
import { ChatService } from './chat.service';
import { Content } from 'ionic-angular';
declare let RTCPeerConnection: any;

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css']
})

export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  
  @ViewChild('scrollMe') private myScrollContainer: ElementRef;

  public peerConnection = null;
  public dataChannel = null;
  public roomId; myId; availableRoom: boolean = false;
  public myMessage = []; textMessage = ""; importantText: string;
  public connect: boolean; disconnect: boolean;
  public roomCollection: AngularFirestoreCollection;
  public offerCollection: AngularFirestoreCollection;
  public answerCollection: AngularFirestoreCollection;
  public checkRoom: boolean = false;
  public sendValue = {};
  public peerType: string;
  public checkAdd = {offer: false, answer: false};

  constructor(
    private _ngZone: NgZone,
    private db: AngularFirestore,
    private chatSerive: ChatService
  ) {
  }

  @HostListener('window:unload', [ '$event' ])
  unloadHandler(event) {
    this.deleteDatabase();
  }

  @HostListener('window:beforeunload', [ '$event' ])
  beforeUnloadHander(event) {
    this.deleteDatabase();
  }
  
  ngOnInit(): void
  {
    this.connect = false;
    this.disconnect = true;
    this.roomCollection = this.db.collection('Room');
    this.offerCollection = this.db.collection('Offer');
    this.answerCollection = this.db.collection('Answer');
    this.scrollToBottom();
  }

  ngOnDestroy(): void
  {
    this.deleteDatabase();
    this.stopConnection();
  }

  ngAfterViewChecked()
  {        
    this.scrollToBottom();        
  } 

  scrollToBottom(): void {
      try {
          this.myScrollContainer.nativeElement.scrollTop = this.myScrollContainer.nativeElement.scrollHeight;
      } catch(err) { }                 
  }

  createConnection()
  {
    this.sendValue = {};
    this.checkAdd = {offer: false, answer: false};
    this.checkRoom = false;
    this.myId = this.guid();
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.services.mozilla.com" },
        { urls: "stun:stun.l.google.com:19302" }
      ]
    }, { optional: [] });
    this.chatSerive.getAvailableOffer()
      .subscribe(data => 
      {
        if (!this.checkRoom)
        {
          if (data.length == 0)
            this.createOffer();
          else
            this.createAnswer(data);
          this.checkRoom = true;
        }
        this.checkRoom = true;
      })
  }

  createOffer()
  {
    this.peerType = 'offer';
    this.sendRTC('Offer', this.myId, 'active', 'waiting');
    this.peerConnection.onicecandidate = (event) => {
      event.candidate ? this.sendRTC('Offer', this.myId, 'ice', JSON.stringify({ ice: event.candidate })) : console.log("Sent All Ice");
    }
    this.importantText = "Connecting you to other Questies";
    this.dataChannel = this.peerConnection.createDataChannel(this.roomId);
    this.peerConnection.createOffer()
    .then((offer) => this.peerConnection.setLocalDescription(offer))
    .then(() => this.sendRTC('Offer', this.myId, 'offer', JSON.stringify({ sdp: this.peerConnection.localDescription })));

    this.dataChannel.onopen = (event) =>  {
      console.log("readyState: ", this.dataChannel.readyState);
      this.sendRTC('Offer', this.myId, 'active', 'sucessful');
      this._ngZone.run(() => {
        this.importantText = "You're connected with a Questies. You can chat with your friendly Questies now.";
      })
    }
    this.dataChannel.onclose = (event) => {
      console.log("readyState: ", this.dataChannel.readyState);
      this.deleteDatabase();
      this.stopConnection();
      this._ngZone.run(() => {
        this.importantText = "You're disconnected with your friendly Questies";
      })
    }
    this.dataChannel.onmessage = (event) => 
    {
      this._ngZone.run(() => {
        this.myMessage.push({sender: 'Friendly Questies', message: event.data});
      })
    };
    this.offerCollection.doc(this.myId).valueChanges()
      .subscribe((data:any) => 
      {
        if (data.hasOwnProperty('answerer'))
          this.answerCollection.doc(data.answerer).valueChanges()
            .subscribe(answerData => this.readMessage(answerData, 'Offer'))
      })
  }

  createAnswer(data)
  {
    this.peerType = 'answer';
    this.sendRTC('Answer', this.myId, 'active', 'waiting');
    let num = this.getRandomInt(data.length);
    this.db.collection('Offer').doc(data[num].id).update({active : 'answering'});
    this.offerCollection.doc(data[num].id).valueChanges()
      .subscribe(offerData => this.readMessage(offerData, 'Answer'));
    data[num]['answerer'] = this.myId;
    this.offerCollection.doc(data[num].id).update(data[num]);
    this.peerConnection.onicecandidate = (event) => {
      event.candidate ? this.sendRTC('Answer', this.myId, 'ice', JSON.stringify({ ice: event.candidate })) : console.log("Sent All Ice");
    }
    this.peerConnection.ondatachannel = (event) => 
    {
      this.dataChannel = event.channel;
      this.dataChannel.onmessage = (event) => 
      {
        this._ngZone.run(() => {
          this.myMessage.push({sender: 'Friendly Questies', message: event.data});
        })
      }
      this.dataChannel.onopen = (event) =>  {
        console.log("readyState: ", this.dataChannel.readyState);
        this.sendRTC('Answer', this.myId, 'active', 'sucessful');
        this._ngZone.run(() => {
          this.importantText = "You're connected with a Questies. You can chat with your friendly Questies now.";
        })
      }
      this.dataChannel.onclose = (event) => {
        console.log("readyState: ", this.dataChannel.readyState);
        this.deleteDatabase();
        this.stopConnection();
        this._ngZone.run(() => {
          this.importantText = "You're disconnected with your friendly Questies";
        })
      }
    }
  }

  sendRTC(database: string, id: string, type: string, message: string)
  {
    this.sendValue[type] = message;
    this.db.collection(database).doc(id).set(this.sendValue);
  }

  readMessage(data, type: string)
  {
    let msg;
    if (data.hasOwnProperty('ice'))
    {
      msg = JSON.parse(data.ice);
      this.peerConnection.addIceCandidate(new RTCIceCandidate(msg.ice));
    }
    if (data.hasOwnProperty('offer') && !this.checkAdd.offer)
    {
      msg = JSON.parse(data.offer);
      this.peerConnection.setRemoteDescription(new RTCSessionDescription(msg.sdp))
          .then(() => this.peerConnection.createAnswer())
          .then(answer =>
            {
              this.checkAdd.offer = true
              this.peerConnection.setLocalDescription(answer)
            })
          .then(() => this.sendRTC('Answer', this.myId, 'answer', JSON.stringify({'sdp': this.peerConnection.localDescription})));
    }
    if (data.hasOwnProperty('answer') && !this.checkAdd.answer)
    {
      msg = JSON.parse(data.answer);
      this.checkAdd.answer = true;
      this.peerConnection.setRemoteDescription(new RTCSessionDescription(msg.sdp));
    }
  }

  isEmpty(obj): boolean
  {
    for(var key in obj) {
        if(obj.hasOwnProperty(key))
            return false;
    }
    return true;
  }

  getRandomInt(max): number
  {
    return Math.floor(Math.random() * Math.floor(max));
  }

  guid() {
    return (this.s4() + this.s4() + "-" + this.s4() + "-" + this.s4() + "-" + this.s4() + "-" + this.s4() + this.s4() + this.s4());
  }
  s4() {
    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  }

  sendMessage()
  {
    this.myMessage.push({sender: 'You', message: this.textMessage})
    this.dataChannel.send(this.textMessage);
    this.textMessage="";
  }

  stopConnection()
  {
    this.dataChannel.close();
    this.peerConnection.close();

    this.dataChannel = null;
    this.peerConnection = null;

    this.deleteDatabase();

    this.peerType = "";
    this.checkRoom = false;

    console.log("stop connection");
  }

  deleteDatabase()
  {
    if (this.peerType == 'offer')
      this.offerCollection.doc(this.myId).delete();
    else
      this.answerCollection.doc(this.myId).delete();
  }
}

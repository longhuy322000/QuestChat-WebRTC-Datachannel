import { Component, OnInit, NgZone, OnDestroy, HostListener, ViewChild, ElementRef, AfterViewChecked, AfterViewInit  } from '@angular/core';
import { AngularFirestore, AngularFirestoreCollection } from 'angularfire2/firestore';
import { ChatService } from './chat.service';
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
  public roomCollection: AngularFirestoreCollection;
  public offerCollection: AngularFirestoreCollection;
  public answerCollection: AngularFirestoreCollection;
  public checkRoom: boolean = false;
  public sendValue = {};
  public peerType: string;
  public onlineQuesties = 0;
  public connect = false; disconnect = true; closeConnection = false;
  public checkRequest = {offer: false, answer: false};

  constructor(
    private _ngZone: NgZone,
    private db: AngularFirestore,
    private chatSerive: ChatService
  ) {
  }

  @HostListener('window:unload', [ '$event' ])
  unloadHandler(event) {
    this.chatSerive.deleteDatabase(this.myId, this.peerType);
  }

  @HostListener('window:beforeunload', [ '$event' ])
  beforeUnloadHander(event) {
    this.chatSerive.deleteDatabase(this.myId, this.peerType);
  }
  
  ngOnInit(): void
  {
    this.roomCollection = this.db.collection('Room');
    this.offerCollection = this.db.collection('Offer');
    this.answerCollection = this.db.collection('Answer');
    this.getOnlineQuesties();
    this.scrollToBottom();
  }

  ngOnDestroy(): void
  {
    this.chatSerive.deleteDatabase(this.myId, this.peerType);
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

  getOnlineQuesties()
  {
    this.offerCollection.valueChanges()
      .subscribe(offer => 
      {
        this.answerCollection.valueChanges()
          .subscribe(answer => 
          {
            this.onlineQuesties = offer.length + answer.length -2;
          })
      })
  }

  createConnection()
  {
    console.log("creating connection");
    this.connect = true;
    this.disconnect = false; this.closeConnection = false;
    this.checkRequest = {offer: false, answer: false};
    this.peerType = '';
    this.sendValue = {};
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
          console.log(data);
          if (data.length == 0)
            this.createOffer();
          else
          {
            for (let i=0; i<data.length; i++)
            {
              if (data[i].hasOwnProperty('answerer'))
              {
                data.splice(i, 1);;
                i--;
              }
            }
            if(data.length !=0)
              this.createAnswer(data);
            else this.createOffer();
          }
          this.checkRoom = true;
          this.importantText = "Connecting you to other Questies";
        }
        this.checkRoom = true;
      })
  }

  createOffer()
  {
    console.log("creating offer", this.myId);
    this.peerType = 'offer';
    this.sendRTC('Offer', this.myId, 'active', 'waiting');
    this.peerConnection.onicecandidate = (event) => {
      (event && event.candidate) ? this.sendRTC('Offer', this.myId, 'ice', JSON.stringify({ ice: event.candidate })) : console.log("Sent All Ice");
    }
    this.dataChannel = this.peerConnection.createDataChannel(this.roomId);
    this.peerConnection.createOffer()
    .then((offer) => this.peerConnection.setLocalDescription(offer))
    .then(() => this.sendRTC('Offer', this.myId, 'offer', JSON.stringify({ sdp: this.peerConnection.localDescription })));

    this.dataChannel.onopen = (event) =>  {
      if (this.dataChannel)
      {
        console.log("readyState: ", this.dataChannel.readyState);
        this._ngZone.run(() =>
        {
          this.sendRTC('Offer', this.myId, 'active', 'sucessful');
          this.importantText = "You're connected with a Questies. You can chat with your friendly Questies now.";
          this.connect = true;
          this.disconnect = false;
        })
      }
    }
    this.dataChannel.onclose = (event) => {
      if (this.dataChannel)
      {
        console.log("readyState: ", this.dataChannel.readyState);
        this._ngZone.run(() => {
          this.chatSerive.deleteDatabase(this.myId, this.peerType);
          this.stopConnection();
          this.sendRTC('Offer', this.myId, 'active', 'disconnected');
          this._ngZone.run(() =>
          {
            this.importantText = "You're disconnected with your friendly Questies";
            this.connect = true;
            this.disconnect = false;
          })
        })
      }
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
        if (data)
          if (data.hasOwnProperty('answerer'))
          {
            this.answerCollection.doc(data.answerer).valueChanges()
              .subscribe(answerData =>
                {
                  if(answerData)
                    this.readMessage(answerData)
                });
            this.sendValue['answerer'] = data.answerer;
          }
      })
  }

  createAnswer(data)
  {
    this.peerType = 'answer';
    this.sendRTC('Answer', this.myId, 'active', 'waiting');
    let num = this.getRandomInt(data.length);
    this.offerCollection.doc(data[num].id).update({answerer: this.myId});
    this.db.collection('Offer').doc(data[num].id).update({active : 'answering'});
    console.log("creating answer", this.myId, data[num].id);
    this.offerCollection.doc(data[num].id).valueChanges()
      .subscribe(offerData =>
        {
          if (offerData)
            this.readMessage(offerData)
        });
    this.peerConnection.onicecandidate = (event) => {
      (event && event.candidate) ? this.sendRTC('Answer', this.myId, 'ice', JSON.stringify({ ice: event.candidate })) : console.log("Sent All Ice");
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
        if (this.dataChannel)
        {
          console.log("readyState: ", this.dataChannel.readyState);
          this._ngZone.run(() =>
          {
            this.sendRTC('Offer', this.myId, 'active', 'sucessful');
            this.importantText = "You're connected with a Questies. You can chat with your friendly Questies now.";
            this.connect = true;
            this.disconnect = false;
          })
        }
      }
      this.dataChannel.onclose = (event) => {
        if (this.dataChannel)
        {
          console.log("readyState: ", this.dataChannel.readyState);
          this._ngZone.run(() => {
            this.chatSerive.deleteDatabase(this.myId, this.peerType);
            this.stopConnection();
            this.sendRTC('Offer', this.myId, 'active', 'disconnected');
            this._ngZone.run(() =>
            {
              this.importantText = "You're disconnected with your friendly Questies";
              this.connect = true;
              this.disconnect = false;
            })
          })
        }
      }
    }
  }

  nextQuesties()
  {
    this.stopConnection();
    this.createConnection();
  }

  sendRTC(database: string, id: string, type: string, message: string)
  {
    console.log("send: ", type, message)
    this.sendValue[type] = message;
    this.db.collection(database).doc(id).set(this.sendValue);
  }

  readMessage(data)
  {
    let msg;
    if (this.peerType=='answer' && data.hasOwnProperty('answerer'))
    {
      if (data.answerer != this.myId)
      {
        console.log("here", this.myId, data);
        this.stopConnection();
        this.createConnection();
      }
    }
    if (data.hasOwnProperty('ice') && !this.closeConnection)
    {
      msg = JSON.parse(data.ice);
      console.log("added ice");
      this.peerConnection.addIceCandidate(new RTCIceCandidate(msg.ice));
    }
    if (data.hasOwnProperty('offer') && !this.checkRequest.offer && !this.closeConnection)
    {
      msg = JSON.parse(data.offer);
      this.peerConnection.setRemoteDescription(new RTCSessionDescription(msg.sdp))
          .then(() => this.peerConnection.createAnswer())
          .then(answer =>
            {
              console.log("added offer");
              this.checkRequest.offer = true
              this.peerConnection.setLocalDescription(answer)
            })
          .then(() => this.sendRTC('Answer', this.myId, 'answer', JSON.stringify({'sdp': this.peerConnection.localDescription})));
    }
    if (data.hasOwnProperty('answer') && !this.checkRequest.answer && !this.closeConnection)
    {
      console.log("added answer");
      msg = JSON.parse(data.answer);
      this.checkRequest.answer = true;
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
    this.closeConnection = true;
    this.connect = false;
    this.disconnect = true;
    this.importantText = "You're disconnected with your friendly Questies";

    this.chatSerive.deleteDatabase(this.myId, this.peerType);
    
    if (this.dataChannel)
      this.dataChannel.close();
    this.peerConnection.close();


    this.dataChannel = null;
    this.peerConnection = null;

    this.peerType = "";
    this.myId = "";

    this.closeConnection = true;

    console.log("stop connection");
  }
}

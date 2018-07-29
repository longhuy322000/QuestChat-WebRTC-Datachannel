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
  public roomId; myId; answerId;
  public myMessage = []; textMessage = ""; importantText: string;
  public roomCollection: AngularFirestoreCollection;
  public offerCollection: AngularFirestoreCollection;
  public answerCollection: AngularFirestoreCollection;
  public offerQueueCollection: AngularFirestoreCollection;
  public answerQueueCollection: AngularFirestoreCollection;
  public checkRoom: boolean = false; checkRequest: boolean = false;
  public sendValue = {}; addRequest = {offer: false, answer: false};
  public peerType: string;
  public onlineQuesties = 0;
  public connect = false; disconnect = true; closeConnection = false;
  public offerData; answerData;
  public successful: boolean = false;

  constructor(
    private _ngZone: NgZone,
    private db: AngularFirestore,
    private chatSerive: ChatService
  ) {
  }

  @HostListener('window:unload', [ '$event' ])
  unloadHandler(event) {
    this.chatSerive.deleteDatabase(this.myId, this.peerType, this.successful);
  }

  @HostListener('window:beforeunload', [ '$event' ])
  beforeUnloadHander(event) {
    this.chatSerive.deleteDatabase(this.myId, this.peerType, this.successful);
  }
  
  ngOnInit(): void
  {
    this.roomCollection = this.db.collection('Room');
    this.offerCollection = this.db.collection('Offer');
    this.answerCollection = this.db.collection('Answer');
    this.offerQueueCollection = this.db.collection('OfferQueue');
    this.answerQueueCollection = this.db.collection('AnswerQueue');
    this.getOnlineQuesties();
    this.scrollToBottom();
  }

  ngOnDestroy(): void
  {
    this.chatSerive.deleteDatabase(this.myId, this.peerType, this.successful);
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
            this.onlineQuesties = Math.max(0, offer.length + answer.length - 2);
          })
      })
  }

  createConnection()
  {
    this.setUpRTC();
    this.chatSerive.getCollection('OfferQueue')
      .subscribe(data => 
      {
        this.offerData = data;
        this.pairPeerConnection();
      })
    
    this.chatSerive.getCollection('AnswerQueue')
      .subscribe(data => 
      {
        this.answerData = data;
        this.pairPeerConnection();
      })
    this.importantText = "Connecting you to other Questies";
  }

  setUpRTC()
  {
    this.addRequest = {offer: false, answer: false};
    this.connect = true; this.disconnect = false; this.closeConnection = false;
    this.peerType = undefined;
    this.sendValue = {};
    this.checkRoom = false; this.checkRequest = false; this.offerData = undefined; this.answerData = undefined;
    this.myId = this.guid();
    console.log("creating connection", this.myId);
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.services.mozilla.com" },
        { urls: "stun:stun.l.google.com:19302" }
      ]
    }, { optional: [] });
  }

  pairPeerConnection()
  {
    if (!this.offerData || !this.answerData)
      return;
    if (!this.checkRoom && !this.checkRequest)
    {
      if (this.offerData.length <= this.answerData.length)
      {
        this.offerQueueCollection.doc(this.myId).set({offer: true});
        this.peerType = 'offer';
      }
      else
      {
        this.answerQueueCollection.doc(this.myId).set({offer: true});
        this.createAnswer();
        this.peerType = 'answer';
      }
      this.checkRoom = true;
    }
    
    if (this.peerType == 'offer' && !this.checkRequest && this.offerData.length > 1 && this.answerData.length > 1)
      if (this.offerData[1].id==this.myId)
      {
        console.log("deleting data", this.answerData);
        this.checkRequest = true;
        this.answerId = this.answerData[1].id;
        this.answerQueueCollection.doc(this.answerId).delete();
        this.sendRTC('Offer', this.myId, 'answerer', this.answerId);
        this.createOffer();
        this.answerCollection.doc(this.answerId).update({offerer: this.myId});
        this.answerCollection.doc(this.answerId).valueChanges()
          .subscribe(answerData =>
          {
            if(answerData)
              this.readMessage(answerData)
          });
        this.offerQueueCollection.doc(this.myId).delete();
      }
      
    if (this.peerType == 'offer' && !this.checkRequest && this.offerData[this.offerData.length-1].id == this.myId && this.offerData.length-this.answerData.length > 1)
    {
      this.offerQueueCollection.doc(this.myId).delete();
      console.log(this.offerData, this.answerData);
      this.stopConnection();
      this.createConnection();
    }

    if (this.peerType == 'answer' && !this.checkRequest && this.answerData[this.answerData.length-1].id == this.myId && this.answerData.length-this.offerData.length > 1)
    {
      this.answerQueueCollection.doc(this.myId).delete();
      console.log(this.offerData, this.answerData);
      this.stopConnection();
      this.createConnection();
    }
  }

  createOffer()
  {
    console.log("creating offer", this.myId);
    this.sendRTC('Offer', this.myId, 'active', 'waiting'); 
    this.peerConnection.onicecandidate = (event) => {
      event.candidate ? this.sendRTC('Offer', this.myId, 'ice', JSON.stringify({ ice: event.candidate })) : console.log("Sent All Ice");
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
          this.sendRTC('Offer', this.myId, 'active', 'successful');
          this.importantText = "You're connected with a Questies. You can chat with your friendly Questies now.";
          this.connect = true;
          this.disconnect = false;
          this.successful = true;
        })
      }
    }
    this.dataChannel.onclose = (event) => {
      if (this.dataChannel)
      {
        console.log("readyState: ", this.dataChannel.readyState);
        this._ngZone.run(() => {
          this.chatSerive.deleteDatabase(this.myId, this.peerType, this.successful);
          this.stopConnection();
          this.sendRTC('Offer', this.myId, 'active', 'disconnected');
          this._ngZone.run(() =>
          {
            this.importantText = "You're disconnected with your friendly Questies";
            this.connect = true;
            this.disconnect = false;
            this.successful = false;
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
  }

  createAnswer()
  {
    console.log('creating answer', this.myId);
    this.peerType = 'answer';
    this.sendRTC('Answer', this.myId, 'active', 'waiting');
    this.answerCollection.doc(this.myId).valueChanges()
      .subscribe((answerData:any) =>
        {
          if (answerData)
            if (answerData.hasOwnProperty('offerer'))
            {
              this.offerCollection.doc(answerData.offerer).valueChanges()
                .subscribe(offerData =>
                  {
                    if (offerData)
                      this.readMessage(offerData);
                  });
              this.sendValue['offerer'] = answerData.offerer;
            }
        });
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
        if (this.dataChannel)
        {
          console.log("readyState: ", this.dataChannel.readyState);
          this._ngZone.run(() =>
          {
            this.sendRTC('Answer', this.myId, 'active', 'successful');
            this.importantText = "You're connected with a Questies. You can chat with your friendly Questies now.";
            this.connect = true;
            this.disconnect = false;
            this.successful = true;
          })
        }
      }
      this.dataChannel.onclose = (event) => {
        if (this.dataChannel)
        {
          console.log("readyState: ", this.dataChannel.readyState);
          this._ngZone.run(() => {
            this.chatSerive.deleteDatabase(this.myId, this.peerType, this.successful);
            this.stopConnection();
            this.sendRTC('Answer', this.myId, 'active', 'disconnected');
            this._ngZone.run(() =>
            {
              this.importantText = "You're disconnected with your friendly Questies";
              this.connect = true;
              this.disconnect = false;
              this.successful = false;
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
    this.sendValue[type] = message;
    this.db.collection(database).doc(id).set(this.sendValue);
  }

  readMessage(data)
  {
    let msg;
    if (data.hasOwnProperty('offerer') && !this.closeConnection)
    {
      console.log("checking failure", data);
      if (data.offerer != this.myId)
      {
        console.log("so sad :((((");
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
    if (data.hasOwnProperty('offer') && !this.addRequest.offer && !this.closeConnection)
    {
      msg = JSON.parse(data.offer);
      this.peerConnection.setRemoteDescription(new RTCSessionDescription(msg.sdp))
          .then(() => this.peerConnection.createAnswer())
          .then(answer =>
            {
              console.log("added offer");
              this.addRequest.offer = true;
              this.peerConnection.setLocalDescription(answer)
            })
          .then(() => this.sendRTC('Answer', this.myId, 'answer', JSON.stringify({'sdp': this.peerConnection.localDescription})));
    }
    if (data.hasOwnProperty('answer') && !this.addRequest.answer && !this.closeConnection)
    {
      console.log("added answer");
      msg = JSON.parse(data.answer);
      this.addRequest.answer = true;
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

    this.chatSerive.deleteDatabase(this.myId, this.peerType, this.successful);
    
    if (this.dataChannel)
      this.dataChannel.close();
    this.peerConnection.close();


    this.dataChannel = null;
    this.peerConnection = null;

    this.peerType = undefined;
    this.myId = "";

    this.closeConnection = true;

    console.log("stop connection");
  }
}

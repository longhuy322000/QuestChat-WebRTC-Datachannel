import { Component, OnInit, NgZone } from '@angular/core';
import { AngularFirestore, AngularFirestoreCollection } from 'angularfire2/firestore';
import { ChatService } from './chat.service';
import { THIS_EXPR } from '../../../node_modules/@angular/compiler/src/output/output_ast';
declare let RTCPeerConnection: any;

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css']
})
export class ChatComponent implements OnInit {

  public peerConnection = null;
  public dataChannel = null;
  public roomId; myId; availableRoom: boolean = false;

  public localConnection = null;
  public remoteConnection = null;
  public sendChannel = null;
  public receiveChannel = null;
  public myMessage = []; textMessage = "";
  public connect: boolean; disconnect: boolean;
  public roomCollection: AngularFirestoreCollection;
  public checkRoom: boolean = false;

  constructor(
    private _ngZone: NgZone,
    private db: AngularFirestore,
    private chatSerive: ChatService
  ) {
  }
  
  ngOnInit(): void {
    this.connect = false;
    this.disconnect = true;
    this.roomCollection = this.db.collection('Room');
    this.setUpRTC();
  }

  setUpRTC()
  {
    this.myId = this.guid();
    //this.roomId = this.db.createId();
    this.roomId = 'testing';
    this.chatSerive.getChanges(this.roomId)
      .subscribe(data =>
        {
          if (!this.checkRoom)
          {
            console.log(data);
            this.checkRoom = true;
            this.isEmpty(data)? this.availableRoom=true : this.availableRoom=false;
          }
        });
      
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.services.mozilla.com" },
        { urls: "stun:stun.l.google.com:19302" }
      ]
    }, { optional: [] });
    // this.peerConnection.onicecandidate = (event) => {
    //   event.candidate ? this.sendIceCandidate('ice', JSON.stringify({ ice: event.candidate })) : console.log("Sent All Ice");
    // }
  }

  createConnection()
  {
    debugger;
    console.log(this.availableRoom);
    this.chatSerive.getChanges(this.roomId)
      .subscribe(data => this.readMessage(data));
    if (this.availableRoom)
    {
      this.dataChannel = this.peerConnection.createDataChannel(this.roomId);
      this.peerConnection.createOffer()
      .then((offer) => this.peerConnection.setLocalDescription(offer))
      .then(() => this.sendIceCandidate('offer', JSON.stringify({ sdp: this.peerConnection.localDescription })));
    }
    else
    {
      this.peerConnection.ondatachannel = (event) => 
      {
        this.dataChannel = event.channel;
      }
    }
    this.dataChannel.onopen = (event) => { console.log("readyState: ", this.dataChannel.readyState) };
    this.dataChannel.onclose = (event) => { console.log("readyState: ", this.dataChannel.readyState) };
    this.dataChannel.onmessage = (event) => 
    {
      this._ngZone.run(() => {
        this.myMessage.push(event.data);
      })
    };
  }

  sendIceCandidate(type: string, ice: string)
  {
    this.roomCollection.doc(this.roomId).set({type: type, sender: this.myId, message: ice});
  }

  readMessage(data)
  {
    console.log(data);
    let msg = data.message;
    let sender = data.sender;
    if (sender != this.myId)
    {
      if (data.type == 'ice')
        this.peerConnection.addIceCandidate(new RTCIceCandidate(msg.ice));
      else if (data.type == "offer")
        this.peerConnection.setRemoteDescription(new RTCSessionDescription(msg.sdp))
          .then(() => this.peerConnection.createAnswer())
          .then(answer => this.peerConnection.setLocalDescription(answer))
          .then(() => this.sendIceCandidate('answer', JSON.stringify({'sdp': this.peerConnection.localDescription})));
      else if (data.type == "answer")
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

  guid() {
    return (this.s4() + this.s4() + "-" + this.s4() + "-" + this.s4() + "-" + this.s4() + "-" + this.s4() + this.s4() + this.s4());
  }
  s4() {
    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  }

  handleCreateDescriptionError(error)
  {
    console.log("Unable to create an offer: " + error.toString());
  }

  handleRemoteAddCandidateSuccess()
  {
    console.log("Add candidate success to remote");
  }

  handleLocalAddCandidateSuccess()
  {
    console.log("Add candidate success to local");
  }

  handleAddCandidateError()
  {
    console.log("Oh noes! addICECandidate failed!");
  }

  sendMessage()
  {
    this.sendChannel.send(this.textMessage);
    this.textMessage="";
  }

  stopConnection()
  {
    this.sendChannel.close();
    this.receiveChannel.close();
    
    this.localConnection.close();
    this.remoteConnection.close();

    this.sendChannel = null;
    this.receiveChannel = null;
    this.localConnection = null;
    this.remoteConnection = null;

    console.log("stop connection");
  }

}

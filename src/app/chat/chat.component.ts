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
  public myMessage = []; textMessage = ""; importantText: string;
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
      .subscribe(data => this.readMessage(data));
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.services.mozilla.com" },
        { urls: "stun:stun.l.google.com:19302" }
      ]
    }, { optional: [] });
    this.peerConnection.onicecandidate = (event) => {
      event.candidate ? this.sendRTC(JSON.stringify({ ice: event.candidate })) : console.log("Sent All Ice");
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
        this._ngZone.run(() => {
          this.importantText = "You're connected with a Questies. You can chat with your friendly Questies now.";
        })
      }
      this.dataChannel.onclose = (event) => {
        console.log("readyState: ", this.dataChannel.readyState);
        this._ngZone.run(() => {
          this.importantText = "You're disconnected with your friendly Questies";
        })
      }
    }
  }

  createConnection()
  {
    this.importantText = "Connecting you to other Questies";
    this.dataChannel = this.peerConnection.createDataChannel(this.roomId);
    this.peerConnection.createOffer()
    .then((offer) => this.peerConnection.setLocalDescription(offer))
    .then(() => this.sendRTC(JSON.stringify({ sdp: this.peerConnection.localDescription })));

    this.dataChannel.onopen = (event) =>  {
      console.log("readyState: ", this.dataChannel.readyState);
      this._ngZone.run(() => {
        this.importantText = "You're connected with a Questies. You can chat with your friendly Questies now.";
      })
    }
    this.dataChannel.onclose = (event) => {
      console.log("readyState: ", this.dataChannel.readyState);
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
  }

  sendRTC(msg: string)
  {
    this.roomCollection.doc(this.roomId).update({sender: this.myId, message: msg});
  }

  readMessage(data)
  {
    let msg = JSON.parse(data.message);
    let sender = data.sender;
    if (sender != this.myId)
    {
      if (msg.ice != undefined)
        this.peerConnection.addIceCandidate(new RTCIceCandidate(msg.ice));
      else if (msg.sdp.type == "offer")
        this.peerConnection.setRemoteDescription(new RTCSessionDescription(msg.sdp))
          .then(() => this.peerConnection.createAnswer())
          .then(answer => this.peerConnection.setLocalDescription(answer))
          .then(() => this.sendRTC(JSON.stringify({'sdp': this.peerConnection.localDescription})));
      else if (msg.sdp.type == "answer")
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

    console.log("stop connection");
  }

}

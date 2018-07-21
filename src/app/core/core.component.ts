import { Component, OnInit } from '@angular/core';
declare let RTCPeerConnection: any;

@Component({
  selector: 'core',
  templateUrl: './core.component.html',
  styleUrls: ['./core.component.css']
})
export class CoreComponent implements OnInit {

  public localConnection = null;
  public remoteConnection = null;
  public sendChannel = null;
  public receiveChannel = null;
  public myMessage = [];

  constructor() {
  }
  
  ngOnInit(): void {
    
  }

  createConnection()
  {
    this.localConnection = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.services.mozilla.com" },
        { urls: "stun:stun.l.google.com:19302" }
      ]
    }, { optional: [] });
    this.sendChannel = this.localConnection.createDataChannel("sendChannel");
    this.sendChannel.onopen = (event) =>
    {
      if (this.sendChannel) {
        let state = this.sendChannel.readyState;
      
        if (state === "open") {
          console.log("maybe successful sent message?")
        } else {
          console.log("maybe failed sent message?")
        }
      }
    };
    this.sendChannel.onclose = (event) => 
    {
      if (this.sendChannel) {
        let state = this.sendChannel.readyState;
      
        if (state === "open") {
          console.log("maybe successful sent message?")
        } else {
          console.log("maybe failed sent message?")
        }
      }
    };

    this.remoteConnection = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.services.mozilla.com" },
        { urls: "stun:stun.l.google.com:19302" }
      ]
    }, { optional: [] });
    this.remoteConnection.ondatachannel = (event) => 
    {
      this.receiveChannel = event.channel;
      this.receiveChannel.onmessage = (event) => 
      {
        this.myMessage.push(event.data);
        console.log(this);
      };
      this.receiveChannel.onopen = (event) =>
      {
        if (this.receiveChannel)
          console.log("Receive channel's status has changed to " + this.receiveChannel.readyState);
      }
      this.receiveChannel.onclose = (event) => 
      {
        if (this.receiveChannel)
          console.log(this.receiveChannel, "Receive channel's status has changed to " + this.receiveChannel.readyState);
      };
    }

    this.localConnection.onicecandidate = (e) => !e.candidate
      || this.remoteConnection.addIceCandidate(e.candidate)
    .catch(this.handleAddCandidateError);

    this.remoteConnection.onicecandidate = e => !e.candidate
        || this.localConnection.addIceCandidate(e.candidate)
        .catch(this.handleAddCandidateError);

    this.localConnection.createOffer()
    .then(offer => this.localConnection.setLocalDescription(offer))
    .then(() => this.remoteConnection.setRemoteDescription(this.localConnection.localDescription))
    .then(() => this.remoteConnection.createAnswer())
    .then(answer => this.remoteConnection.setLocalDescription(answer))
    .then(() => this.localConnection.setRemoteDescription(this.remoteConnection.localDescription))
    .catch(this.handleCreateDescriptionError);
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

  sendMessage(message: string)
  {
    console.log("sent", Date.now());
    this.sendChannel.send(message);
  }

  handleSendChannelStatusChange(event)
  {
    if (this.sendChannel) {
      let state = this.sendChannel.readyState;
    
      if (state === "open") {
        console.log("maybe successful sent message?")
      } else {
        console.log("maybe failed sent message?")
      }
    }
  }  

  receiveChannelCallback(event)
  {
    let tempMessage;
    this.receiveChannel = event.channel;
    this.receiveChannel.onmessage = (event) => 
    {
      tempMessage = event.data;
      console.log(event.data);
    };
    this.receiveChannel.onopen = (event) =>
    {
      if (this.receiveChannel)
        console.log("Receive channel's status has changed to " + this.receiveChannel.readyState);
    }
    this.receiveChannel.onclose = (event) => 
    {
      if (this.receiveChannel)
        console.log(this.receiveChannel, "Receive channel's status has changed to " + this.receiveChannel.readyState);
    };
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

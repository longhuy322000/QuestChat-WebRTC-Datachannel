import { Injectable } from '@angular/core';
import { AngularFirestore, AngularFirestoreCollection } from 'angularfire2/firestore'

@Injectable({
  providedIn: 'root'
})
export class ChatService {

  public roomCollection: AngularFirestoreCollection;

  constructor(
    private db: AngularFirestore
  ) {
    this.roomCollection = this.db.collection('Room');
  }

  getAvailableRoom()
  {
    return this.db.collection('Room').snapshotChanges();
  }

  getChanges(id)
  {
    return this.db.collection('Room').doc(id).valueChanges();
  }
}

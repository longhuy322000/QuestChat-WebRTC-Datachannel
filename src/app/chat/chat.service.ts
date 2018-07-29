import { Injectable } from '@angular/core';
import { AngularFirestore, AngularFirestoreCollection } from 'angularfire2/firestore';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs'

@Injectable({
  providedIn: 'root'
})
export class ChatService {

  public roomCollection: AngularFirestoreCollection;
  public offerCollection: AngularFirestoreCollection;
  public answerCollection: AngularFirestoreCollection;

  constructor(
    private db: AngularFirestore
  ) {
    this.roomCollection = this.db.collection('Room');
    this.offerCollection = this.db.collection('Offer');
    this.answerCollection = this.db.collection('Answer');
  }

  getCollection(database: string)
  {
    return this.db.collection(database).snapshotChanges().pipe(
      map(actions => actions.map(a => 
      {
        const id = a.payload.doc.id;
        const data = a.payload.doc.data;
        return {id, ...data};
      }))
    )
  }

  getChanges(id)
  {
    return this.db.collection('Room').doc(id).valueChanges();
  }

  deleteDatabase(id: string, peerType: string)
  {
    this.offerCollection.doc(id).delete();
    this.answerCollection.doc(id).delete();
  }
}

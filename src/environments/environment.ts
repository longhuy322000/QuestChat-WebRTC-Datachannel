// This file can be replaced during build by using the `fileReplacements` array.
// `ng build ---prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: true,
  firebase: {
    apiKey: "AIzaSyC2L4-nBEWpnA8_DrsKAtvcwQ_B7LqzaKY",
    authDomain: "questchat-2018.firebaseapp.com",
    databaseURL: "https://questchat-2018.firebaseio.com",
    projectId: "questchat-2018",
    storageBucket: "questchat-2018.appspot.com",
    messagingSenderId: "65029895800"
  }
};

/*
 * In development mode, to ignore zone related error stack frames such as
 * `zone.run`, `zoneDelegate.invokeTask` for easier debugging, you can
 * import the following file, but please comment it out in production mode
 * because it will have performance impact when throw error
 */
// import 'zone.js/dist/zone-error';  // Included with Angular CLI.

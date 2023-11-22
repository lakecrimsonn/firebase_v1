/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

// // http request 1
// exports.randomNumber = onRequest((request, response) => {
//   const number = Math.round(Math.random() * 100);
//   response.send(number.toString());
// });

// // http request 2
// exports.toTheDojo = onRequest((request, response) => {
//   console.log("네이버 가는 중");
//   response.redirect("https://www.naver.com");
// });

// cors
// const cors = require("cors")({
//   origin: ["http://localhost:5000", "https://us-central1-popticle-71e6e.cloudfunctions.net"],
//   credentials: true,
// });

const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

// http callable function
exports.sayHello = functions.https.onCall((request) => {
  const name = request.name;
  return `hello ${name}`;
});

// auth trigger (new user signup)
exports.newUserSignup = functions.auth.user().onCreate((user) => {
  console.log("** user created", user.email, user.uid);
  // for background triggers you must return a value/promise
  return admin.firestore().collection("users").doc(user.uid).set({
    email: user.email,
    upvotedOn: [],
  });
});

// auth trigger (user deleted)
exports.userDeleted = functions.auth.user().onDelete((user) => {
  console.log("** user deleted", user.email, user.uid);
  const doc = admin.firestore().collection("users").doc(user.uid);
  return doc.delete();
});

// http callable function (adding a request)
// https://firebase.google.com/docs/reference/node/firebase.functions
exports.addRequests = functions.https.onCall((data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
        "unauthenticated",
        "** only authenticated users can add requests",
    );
  }
  if (data.text.length > 30) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "** request must be no more than 30 characters long",
    );
  }
  // it is a promise function
  return new Promise((resolve, reject)=>{
    admin.firestore().collection("requests").add({
      text: data.text,
      upvotes: 0,
    }).then(()=>{
      return resolve();
    }).catch((e)=>{
      return reject(e);
    });
  });
});

// upvote callable function
exports.upvote = functions.https.onCall(async (data, context) => {
  // check auth state
  if (!context.auth) {
    throw new functions.https.HttpsError(
        "unauthenticated",
        "** only authenticated users can add requests",
    );
  }
  // get refs for user doc and request doc
  const user = admin.firestore().collection("users").doc(context.auth.uid);
  const request = admin.firestore().collection("requests").doc(data.id);

  const doc = await user.get();
  // check user hasnt already upvoted the request
  if (doc.data().upvotedOn.includes(data.id)) {
    throw new functions.https.HttpsError(
        "failed-precondition",
        "** you can only upvote something once",
    );
  }
  // update user array
  await user.update({
    upvotedOn: [...doc.data().upvotedOn, data.id],
  });
  // update votes on the request
  return request.update({
    upvotes: admin.firestore.FieldValue.increment(1),
  });
});

// firestore trigger for tracking activity
// exports.logActivities = functions.firestore.document("/{collection}/{id}")
//     .onCreate((snap, context)=>{
//       console.log(snap.data());
//       const collection = context.params.collection;
//       // const id = context.params.id;

//       const activities = admin.firestore().collection("activities");

//       if (collection === "requests") {
//         return activities.add({text: "a new tutorial request was added"});
//       }

//       if (collection === "users") {
//         return activities.add({text: "a new user signed up"});
//       }
//     });

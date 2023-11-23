const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");
const path = require("path");
const os = require("os");

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
  return new Promise((resolve, reject) => {
    admin
        .firestore()
        .collection("requests")
        .add({
          text: data.text,
          upvotes: 0,
        })
        .then(() => {
          return resolve();
        })
        .catch((e) => {
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

exports.unity2ai = functions.storage.object().onFinalize(async (object) => {
  if (object.name.startsWith("unity2ai/")) {
    console.log("File uploaded in unity2ai:", object.name);

    // Prepare the file paths
    const tempFilePath = path.join(os.tmpdir(), path.basename(object.name));
    const bucket = admin.storage().bucket();

    // Download the file to the temporary directory
    await bucket.file(object.name).download({destination: tempFilePath});

    // Prepare the form data
    const formData = new FormData();
    formData.append("image_file", fs.createReadStream(tempFilePath));

    // Send the file to the server
    const url = `http://221.163.19.218:33335/main/upload`; // Replace with the actual endpoint
    await axios.post(url, formData, {
      headers: formData.getHeaders(),
    });
    console.log("File sent to server");

    // Clean up the temporary file
    fs.unlinkSync(tempFilePath);
  }
});

// exports.unity2ai = functions.storage.object().onFinalize(async (object) => {
//   if (object.name.startsWith("unity2ai/")) {
//     console.log("File uploaded in unity2ai:", object.name);

//     // const bucket = admin.storage().bucket();
//     // const filePath = path.join("/tmp/unity2ai/", object.name);
//     // await bucket.file(object.name).download({destination: filePath});

//     const url = `http://221.163.19.218:33335/upload`; // Replace with the actual endpoint
//     const formData = new FormData();
//     formData.append("file", fs.createReadStream(object.name));

//     await axios.post(url, formData, {
//       headers: formData.getHeaders(),
//     });
//     console.log("File sent to server");
//   }
// });


// // eslint-disable-next-line require-jsdoc
// async function downloadFile(fileName) {
//   const bucket = admin.storage().bucket();
//   const filePath = path.join("/tmp", fileName);
//   await bucket.file(fileName).download({destination: filePath});
//   return filePath;
// }

// // eslint-disable-next-line require-jsdoc
// async function sendFileToServer(filePath, serverIp) {
//   const url = `http://${serverIp}/upload`; // Replace with the actual endpoint
//   const formData = new FormData();
//   formData.append("file", fs.createReadStream(filePath));

//   const response = await axios.post(url, formData, {
//     headers: formData.getHeaders(),
//   });
//   console.log("File sent to server:", response.data);
// }



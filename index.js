const express = require("express");
const app = express();
const cors = require("cors");
const bodyParser = require("body-parser");
const { google } = require("googleapis");
const nodemailer = require("nodemailer");
const axios = require("axios");
const cookieParser = require("cookie-parser");

const whitelist = ["http://localhost:3000"];
// const corsOptions = {
//   credentials: true, // This is important.
//   origin: (origin, callback) => {
//     if (whitelist.includes(origin)) return cmalli allback(null, true);

//     callback(new Error("Not allowed by CORS"));
//   },
// };
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) {
      //for bypassing postman req with  no origin
      return callback(null, true);
    }
    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
};

app.use(cors(corsOptions));
app.use(cookieParser());

require("dotenv").config();
var Users = [
  {
    username: "poojitha1",
    password: "Pooji@123",
  },
];
var trackData = {};
var uniqueIdMessageMapper = {};

app.use(
  bodyParser.raw({ inflate: true, limit: "100kb", type: "application/json" })
);

app.post("/signup", function (req, res) {
  console.log(JSON.parse(req.body));
  var body = JSON.parse(req.body);
  username = body.username;
  password = body.password;
  console.log(password);
  if (!username && !password) {
    // res.status(400);
    // res.send("Invalid details");
  } else {
    Users.filter(function (user) {
      if (user.username == username) {
        res.send("User Already Exists! Login or choose another username");
      }
    });
    let regex = /^(?=.*[A-Z])(?=.*[!@#$%^&*])(?=.*[0-9].*[0-9]).{8,}$/;
    if (regex.test(password)) {
      var newUser = { username: username, password: password };
      Users.push(newUser);
      // req.session.user = newUser;
      res.send({
        message: "Successfully Created an account",
        status: "success",
      });
    } else {
      res.send("please enter the strong password");
    }
  }
});

app.post("/login", function (req, res) {
  if (!req.body.username && !req.body.password) {
    res.status(400);
    res.send("Invalid details");
  } else {
    Users.filter(function (user) {
      console.log(user);
      if (user.username == req.body.username) {
        if (user.password == req.body.password) {
          res.send("Logged into ur account sucessfully");
        } else {
          res.send("Incorrect Password");
        }
      }
    });
    res.send("You don't have account Please create one");
  }
});

app.get("/generateaccesstoken", async (req, res) => {
  let code = req.query.code;
  console.log(code);
  try {
    const oauth2Client = new google.auth.OAuth2(
      "718457172982-6q7hfr4v6kjj85m9velhb81fud0v9ojs.apps.googleusercontent.com",
      "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",
      "http://localhost:3000"
    );
    let { tokens } = await oauth2Client.getToken(code);

    res.cookie("accessToken", tokens.access_token, {
      maxAge: 3500,
      httpOnly: true,
      domain: "localhost",
    });
    res.cookie("refreshToken", tokens.refresh_token, {
      maxAge: 9000000,
      httpOnly: true,
      domain: "localhost",
    });
    console.log(tokens);
    res.send({
      status: "ok",
    });
  } catch (error) {
    console.log(error);
    res.send("something went wrong");
  }
});

app.post("/getMessages", async (req, res) => {
  var body = JSON.parse(req.body);
  console.log(body);
  var result = [];
  var emailId = body.email;
  var accessToken = req.cookies.accessToken;
  try {
    if (accessToken) {
      const options = {
        method: "get",
        url: `https://gmail.googleapis.com/gmail/v1/users/${emailId}/messages?maxResults=2`,
        headers: {
          Authorization: `Bearer ${accessToken} `,
          "Content-type": "application/json",
        },
      };
      const response = await axios(options);

      // console.log(response.data);
      for (let index = 0; index < response.data.messages.length; index++) {
        const element = response.data.messages[index];
        var id = element.id;
        const mailgettingoptions = {
          method: "get",
          url: `https://gmail.googleapis.com/gmail/v1/users/${emailId}/messages/${id}`,
          headers: {
            Authorization: `Bearer ${accessToken} `,
            "Content-type": "application/json",
          },
        };
        var mailData = await axios(mailgettingoptions);
        var data = {};
        console.log(mailData.data);
        data.snippet = mailData.data.snippet;
        for (let i = 0; i < mailData.data.payload.headers.length; i++) {
          const element = mailData.data.payload.headers[i];
          if (element.name == "To") {
            data.to = element.value;
          }
          if (element.name == "Subject") {
            data.subject = element.value;
          }
          if (element.name == "Message-ID") {
            if (trackData[element.value]) {
              data.viewCount = trackData[element.value];
            } else {
              data.viewCount = 0;
            }
          }
        }
        data.body = mailData.data.payload.body;
        result.push(data);
      }
      res.send(result);
    } else {
      res.send("no acccess token sent in cookies");
    }
  } catch (error) {
    console.log(error);
    res.send("please try again the authorization");
  }
});

app.post("/sendMail", async (req, res) => {
  var body = JSON.parse(req.body);

  var msgBody = body.msgBody;
  var to = body.to;
  var subject = body.subject;
  var emailId = body.email;
  var refreshToken = req.cookies.refreshToken;
  var accessToken = req.cookies.accessToken;
  if (accessToken) {
    if (refreshToken) {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          type: "OAuth2",
          user: emailId,
          accessToken: accessToken,
          clientId:
            "718457172982-6q7hfr4v6kjj85m9velhb81fud0v9ojs.apps.googleusercontent.com",
          clientSecret: "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",
          refreshToken: refreshToken,
        },
      });
      var serverName = process.env.server;
      var uniqueId = Date.now();
      msgBody =
        msgBody +
        `<br/> <img src='${serverName}/track?id=${uniqueId}' style="display:none" >`;

      const mailOptions = {
        from: emailId,
        to: to,
        subject: subject,
        html: msgBody,
      };

      const sentMailRes = await transporter.sendMail(mailOptions);
      console.log(sentMailRes);
      uniqueIdMessageMapper[uniqueId] = sentMailRes.messageId;
      /// sentMailRes.messageId contains the id of the message
      res.send("sent email");
    } else {
      res.send("not recevied refreshToken");
    }
  } else {
    res.send("not recevied accessToken");
  }
});

app.get("/track", (req, res) => {
  var uniqueId = req.query.id;
  var id = uniqueIdMessageMapper[uniqueId];
  if (trackData[id]) {
    trackData[id] = trackData[id] + 1;
  } else {
    trackData[id] = 1;
  }
  console.log(trackData);
  res.statusCode = 200;
  res.sendFile(__dirname + "/test.jpeg");
});

app.listen(3000, () => {
  console.log("listening");
});

// {
//   access_token: 'ya29.a0AXooCguUwi8rUQGtZa_1CSP3na92tirykh-WhSThhanqmjVBCH1aHlwnlbezj52lNb-tEY14zATPbFr9WpOcknmQYZrwYqU9hA8ZEnldF8zODZV8qGeHPEf7c-_9dIYE2IMRNEnfFCexU3cLYITr-fFtuBTS8oFrjXtaaCgYKAfQSARMSFQHGX2MiM6rYLQGiLd5ELZwMZkbDug0171',
//   refresh_token: '1//0gf90tSbrZeR9CgYIARAAGBASNwF-L9IrAJS--AQ2z_ldM9n-tq7YiSbVOC1-kbViyJgJC5vcGr5NNWbgp66c7QLeuOuvJib0vZE',
//   scope: 'https://mail.google.com/',
//   token_type: 'Bearer',
//   expiry_date: 1715217101262
// }

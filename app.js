const { Client, MessageMedia } = require('whatsapp-web.js');
const express = require('express');
const { body, validationResult } = require('express-validator');
const socketIO = require('socket.io');
const qrcode = require('qrcode');
const http = require('http');
const { phoneNumberFormatter } = require('./helpers/formatter');
const fileUpload = require('express-fileupload');
const axios = require('axios');
const favicon = require('serve-favicon');
const path = require('path');
const dateTime = require('node-datetime');
const port = process.env.PORT || 8000;

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));
app.use(fileUpload({
  debug: true
}));


const db = require('./helpers/db.js');

(async()=>{
  app.get('/', (req, res) => {
    res.sendFile('index.html', {
      root: __dirname
    });
  });
  
  app.use(express.static(__dirname+'/public'));
  app.use(favicon(path.join(__dirname, 'public', 'images/favicon.ico')))
  
  const readSession = db.readSession();

  const client = new Client({
    restartOnAuthFail: true,
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process', // <- this one doesn't works in Windows
        '--disable-gpu'
      ],
    },
    session: readSession
  });
  
  client.on('message', msg => {
    if (msg.body == '!ping') {
      msg.reply('pong');
    } else if (msg.body == 'good morning') {
      msg.reply('selamat pagi');
    } else if (msg.body == '!groups') {
      client.getChats().then(chats => {
        const groups = chats.filter(chat => chat.isGroup);
  
        if (groups.length == 0) {
          msg.reply('You have no group yet.');
        } else {
          let replyMsg = '*YOUR GROUPS*\n\n';
          groups.forEach((group, i) => {
            replyMsg += `ID: ${group.id._serialized}\nName: ${group.name}\n\n`;
          });
          replyMsg += '_You can use the group id to send a message to the group._'
          msg.reply(replyMsg);
        }
      });
    }
  });
  
  client.initialize();
  
  // Socket IO
  io.on('connection', function (socket) {
    socket.emit('message', dateTime.create().format('Y-m-d H:M:S') + ' : ' + 'Sedang menyambungkan koneksi...');
  
    client.on('qr', (qr) => {
      console.log('QR RECEIVED', qr);
      qrcode.toDataURL(qr, (err, url) => {
        socket.emit('qr', url);
        socket.emit('message', dateTime.create().format('Y-m-d H:M:S') + ' : ' + 'QR Code ditampilkan, silahkan discan');
      });
    });
  
    client.on('ready', () => {
      socket.emit('ready', 'Whatsapp siap digunakan');
      socket.emit('message', dateTime.create().format('Y-m-d H:M:S') + ' : ' + 'Whatsapp siap digunakan');
    });
  
    client.on('authenticated', (session) => {
      socket.emit('authenticated', 'Whatsapp terotentikasi');
      socket.emit('message', dateTime.create().format('Y-m-d H:M:S') + ' : ' + 'Whatsapp terotentikasi');
      console.log('AUTHENTICATED', session);
      //Save Session to DB
      db.saveSession(session);
    });
  
    client.on('auth_failure', function (session) {
      socket.emit('message', dateTime.create().format('Y-m-d H:M:S') + ' : ' + 'Otentikasi gagal!, mengulang otentikasi...');
    });
  
    client.on('disconnected', (reason) => {
      socket.emit('message', dateTime.create().format('Y-m-d H:M:S') + ' : ' + 'Whatsapp terputus!');
      // Remove Session from DB
      db.removeSession(session);
      client.destroy();
      client.initialize();
    });
  }); 
  
  
  const checkRegisteredNumber = async function (number) {
    const isRegistered = await client.isRegisteredUser(number);
    return isRegistered;
  }
  
  // Send message
  app.post('/send-message', [
    body('number').notEmpty(),
    body('message').notEmpty(),
  ], async (req, res) => {
    const errors = validationResult(req).formatWith(({
      msg
    }) => {
      return msg;
    });
  
    if (!errors.isEmpty()) {
      return res.status(422).json({
        status: false,
        message: errors.mapped()
      });
    }
  
    const number = phoneNumberFormatter(req.body.number);
    const message = '📣 *SIPP Admin [no-reply]* 📣 \n\n'+req.body.message;
    
    const isRegisteredNumber = await checkRegisteredNumber(number);
  
    if (!isRegisteredNumber) {
      return res.status(422).json({
        status: false,
        message: 'The number is not registered'
      });
    }
  
    client.sendMessage(number, message).then(response => {
      res.status(200).json({
        status: true,
        response: response
      });
    }).catch(err => {
      res.status(500).json({
        status: false,
        response: err
      });
    });
  });
  
  // Send media
  app.post('/send-media', async (req, res) => {
    const number = phoneNumberFormatter(req.body.number);
    const caption = req.body.caption;
    const fileUrl = req.body.file;
  
    // const media = MessageMedia.fromFilePath('./image-example.png');
    // const file = req.files.file;
    // const media = new MessageMedia(file.mimetype, file.data.toString('base64'), file.name);
    let mimetype;
    const attachment = await axios.get(fileUrl, {
      responseType: 'arraybuffer'
    }).then(response => {
      mimetype = response.headers['content-type'];
      return response.data.toString('base64');
    });
  
    const media = new MessageMedia(mimetype, attachment, 'Media');
  
    client.sendMessage(number, media, {
      caption: caption
    }).then(response => {
      res.status(200).json({
        status: true,
        response: response
      });
    }).catch(err => {
      res.status(500).json({
        status: false,
        response: err
      });
    });
  });
  
  // Send message to group
  // -- Send message !groups to get all groups (id & name)
  // -- So you can use that group id to send a message
  app.post('/send-group-message', [
    body('id').notEmpty(),
    body('message').notEmpty(),
  ], async (req, res) => {
    const errors = validationResult(req).formatWith(({
      msg
    }) => {
      return msg;
    });
  
    if (!errors.isEmpty()) {
      return res.status(422).json({
        status: false,
        message: errors.mapped()
      });
    }
  
    const chatId = req.body.id;
    const message = req.body.message;
  
    client.sendMessage(chatId, message).then(response => {
      res.status(200).json({
        status: true,
        response: response
      });
    }).catch(err => {
      res.status(500).json({
        status: false,
        response: err
      });
    });
  });
  
  server.listen(port, function () {
    console.log('App running on *: ' + port);
  });
})();



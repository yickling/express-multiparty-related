const fs = require('fs');
const express = require('express');
const multiparty = require('multiparty');
const request = require('request');

const frontend = require('./frontend');

const app = express();

app.get('/', function (req, res) {
  res.send(frontend);
  res.end();
});

app.get('/v1/digital-accounts/enquire', function (req, res) {
  console.error('++++++++HEADERS+++++++');
  console.error(req.headers);
  console.error('+++++++QUERY++++++++');
  console.error(req.query);
  console.error('+++++++++++++++');
  res.send('ok');
  res.end();
});

app.post('/testUpload', function (req, res) {
  const jsonPayload = { field1: 'one', field2: 2.0, field3: [{ field4: 'four'}] };
  const imagePath = './image.png';
  const imageStream = fs.createReadStream(imagePath);

  request.post({
    method: 'POST',
    preambleCRLF: true,
    postambleCRLF: true,
    uri: `http://localhost:3000/upload`,
    multipart: {
      chunked: true,
      data: [
        {
          'content-type': 'application/json',
          body: JSON.stringify(jsonPayload)
        },
        {
          'Content-Type': 'image/png',
          'Content-Description': `fileId="image.png"; filename="image.png"`,
          'Content-Transfer-Encoding': 'binary',
          body: imageStream
        }
      ]
    }
  }, function(err, response, body) {
    if (err) {
      res.status(500).send(err);
    } else {
      res.status(200).send('ok');  
    }
  });
});

// accept POST request on the homepage
app.post('/upload', function (req, res) {
  console.error('here!')
  parseMultipartRelated(req, './uploads')
    .then(({ fields, files }) => {
      console.log('----------- fields -----------');
      console.log(fields);
      console.log('----------- end of fields -----------');
      res.status(200).send('ok');
    })
    .catch((err) => {
      res.status(500).send(err);
    });
});


function parseMultipartRelated(req, uploadDir) {
  return new Promise((resolve, reject) => {
    var fields = {}, files = [];
    var fieldsBuffer = '';
    var fileStreams = [];

    const pathExists = fs.existsSync(uploadDir);
    if (!pathExists) {
      fs.mkdirSync(uploadDir);
    }

    var form = new multiparty.Form({maxFieldsSize: 10 * 1024 * 1024, maxFilesSize: 10 * 1024 * 1024, uploadDir});

    form.on('error', function(err) {
      return reject(err);
    });

    form.on('part', function(part) {
      part.on('error', function(err) {
        return reject(err);
      });

      // Must be either file or JSON
      if (part.headers['content-type'].indexOf('application/json') === -1) {
        let dataObject = {};

        if (!part.headers['content-description']) {
          return reject(createError({ statusCode: 422, meta: { details: 'Content-Description not found for non JSON input' } }));
        }

        const filename = 'image.png';

        if (!filename) {
          return reject(createError({ statusCode: 422, meta: { details: 'filename not supplied for attached file' } }));
        }

        const saveTo = `${uploadDir}/${filename}`;
        const outputStream = fs.createWriteStream(saveTo, { defaultEncoding: 'binary'});
        part.pipe(outputStream);
        fileStreams.push(outputStream);

        dataObject['Content-Type'] = part.headers['content-type'];
        dataObject['Content-Description'] = part.headers['content-description'];

        dataObject.filename = saveTo;
        files.push(dataObject);
      }

      part.on('data', function(data) {
        if (part.headers['content-type'].indexOf('application/json') > -1) {
          fieldsBuffer += data;
        }
      });

      part.on('end', function() {
        let dataObject = {};

        if (!part.headers['content-type'])
          return reject('content-type not provided');

        if (part.headers['content-type'].indexOf('application/json') > -1) {
          dataObject.body = JSON.parse(fieldsBuffer);
          fields = dataObject.body;
          fieldsBuffer = '';
        }
      });
    });

    form.on('close', function() {
      fileStreams.forEach((stream) => {
        stream.end();
      });
      return resolve({ fields, files });
    });

    form.parse(req);

  });
}

const server = app.listen(3000, function () {

  var host = server.address().address
  var port = server.address().port

  console.log('Example app listening at http://%s:%s', host, port)

});

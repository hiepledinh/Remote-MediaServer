const net = require('net');
const Settings = require('../Settings');
const readline = require('readline');
const Crypt = require('./Crypt');
const Log = require('../helpers/Log');
const fs = require('fs');
const FileProcessor = require('./FileProcessor');

class TcpServer {
  constructor() {
    this.server = net.createServer(TcpServer.connected);
    this.server.listen(Settings.getValue('shareport'));
  }

  /**
   * @todo  doesn't always disconnect??
   * @param socket
   */
  static connected(socket) {
    Log.debug('sharing, new peer connection');
    socket.on('error', (e) => {
      Log.debug('error in share socket connection', e);
    });
    readline
      .createInterface(socket)
      .on('line', (line) => {
        if (line === Settings.getValue('sharekey')) {
          Log.debug('serve database');
          const db = fs.createReadStream('share/db');
          const stream = Crypt.encrypt(
            db,
            Buffer.from(Settings.getValue('dbKey'), 'hex'),
            Buffer.from(Settings.getValue('dbNonce'), 'hex'),
          );
          stream.pipe(socket);
        } else if (line.split('-').length >= 3) {
          const [hash, , id] = line.split('-');
          const stream = FileProcessor.getReadStream(id, hash);
          if (!stream) {
            socket.end();
            return;
          }
          Log.debug('piping file to socket');
          stream.pipe(socket);
          socket.on('close', () => {
            Log.debug(socket.bytesWritten);
            stream.end();
          });
        } else {
          socket.end();
        }
      });
  }
}

module.exports = new TcpServer();

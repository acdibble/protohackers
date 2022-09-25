import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:three/message.dart';

class Room {
  final _members = <String>{};
  final _messages = StreamController<Message>.broadcast();

  Future<void> handleConnection(final Socket socket) async {
    String? name;
    StreamSubscription? sub;
    final lines = ascii.decoder
        .bind(socket)
        .transform(const LineSplitter())
        .asBroadcastStream();

    try {
      socket.write(Message('Welcome to budgetchat! What shall I call you?'));
      name = await lines.first;

      if (_members.contains(name) || !RegExp(r'^[\w\d]+$').hasMatch(name)) {
        return;
      }

      socket.write(Message('The room contains: ${_members.join(', ')}'));
    } catch (_) {
      socket.close();
      return;
    }

    _members.add(name);

    _messages.sink.add(Message('* $name has entered the room'));

    sub = _messages.stream
        .where((msg) => msg.author != name)
        .listen((msg) => socket.write(msg));

    lines.listen((line) => _messages.sink.add(Message(line, name)), onDone: () {
      sub?.cancel();
      _members.remove(name);
      socket.close();
      _messages.sink.add(Message('* $name has left the room'));
    });
  }
}

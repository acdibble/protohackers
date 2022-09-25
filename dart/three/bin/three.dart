import 'dart:io';

import 'package:three/room.dart';

void main(List<String> arguments) async {
  final server = await ServerSocket.bind('127.0.0.1', 8080);

  final room = Room();

  await for (final socket in server) {
    room.handleConnection(socket).catchError(print);
  }
}

class Message {
  final String message;
  final String? author;

  Message(this.message, [this.author]);

  @override
  String toString() {
    return author == null ? '$message\n' : '[$author] $message\n';
  }
}

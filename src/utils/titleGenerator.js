/**
 * Title Generator Utility
 * Generates meaningful titles for chat history, notes, and other content
 */

class TitleGenerator {
  static generateChatTitle(content, type = 'chat') {
    if (!content) return 'New Chat';
    
    // Extract first meaningful text
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    const words = text.split(/\s+/).slice(0, 5).join(' ');
    
    if (type === 'image') {
      return `Image Analysis: ${words}...`;
    } else if (type === 'quiz') {
      return `Quiz Session: ${words}...`;
    } else if (type === 'mindmap') {
      return `Mind Map: ${words}...`;
    } else {
      return words.length > 20 ? `${words.substring(0, 20)}...` : words;
    }
  }

  static generateNoteTitle(content) {
    if (!content) return 'Untitled Note';
    
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    const firstLine = text.split('\n')[0];
    return firstLine.length > 30 ? `${firstLine.substring(0, 30)}...` : firstLine;
  }

  static generateQuizTitle(topic) {
    if (!topic) return 'New Quiz';
    return `Quiz: ${topic}`;
  }

  static generateStudyPlanTitle(subject) {
    if (!subject) return 'Study Plan';
    return `Study Plan: ${subject}`;
  }
}

module.exports = TitleGenerator;

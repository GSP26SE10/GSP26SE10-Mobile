import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { TEXT_PRIMARY, BACKGROUND_WHITE, PRIMARY_COLOR, TEXT_SECONDARY, BORDER_LIGHT } from '../constants/colors';

const { width } = Dimensions.get('window');

// Mock chat messages
const initialMessages = [
  {
    id: 1,
    text: "Good morning! We're from Bobo Foods, how may I help you?",
    isUser: false,
    timestamp: '09:00',
  },
  {
    id: 2,
    text: "I have ordered for a pepperoni cheese pizza but I have received a different. There must have been a mistake somewhere. Please replace it.",
    isUser: true,
    timestamp: '09:05',
  },
  {
    id: 3,
    text: "We are very sorry to hear that. We will immediately resend the delivery guy for replacement. But first, please send a picture of the pizza for confirmation.",
    isUser: false,
    timestamp: '09:10',
  },
  {
    id: 4,
    text: "Here's a picture for confirmation. Now's please + replace it. Thank you.",
    isUser: true,
    timestamp: '09:15',
    image: 'https://scontent.fsgn16-1.fna.fbcdn.net/v/t39.30808-6/548570477_1189728099855961_5240077253445441952_n.jpg?_nc_cat=100&ccb=1-7&_nc_sid=127cfc&_nc_ohc=Lqp7XKTpjhEQ7kNvwGmL7JP&_nc_oc=AdlFm094dgSxWykFEBHlV5urvU6TtYvqvBW6vGbcWA82Mvri8OXfcl2mq02l7coDg9n7jaq7KjGdKQ3oAFYMnzGc&_nc_zt=23&_nc_ht=scontent.fsgn16-1.fna&_nc_gid=QckBobUcEcuU-15xcs2WdA&oh=00_AfuoPMLP6B9c7ArmiRL3hG_mzjPAZa_aRe3Yl5zro9aGxw&oe=698954C8',
  },
];

export default function ChatScreen({ navigation }) {
  const [messages, setMessages] = useState(initialMessages);
  const [inputText, setInputText] = useState('');
  const insets = useSafeAreaInsets();
  const swipeBack = useSwipeBack(() => navigation.goBack());

  const handleSend = () => {
    if (inputText.trim()) {
      const newMessage = {
        id: messages.length + 1,
        text: inputText.trim(),
        isUser: true,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages([...messages, newMessage]);
      setInputText('');
    }
  };

  const handleRemoveImage = (messageId) => {
    setMessages(messages.map(msg => 
      msg.id === messageId ? { ...msg, image: null } : msg
    ));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']} {...swipeBack.panHandlers}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={28} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chat</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Chat Messages */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageWrapper,
                message.isUser ? styles.messageWrapperUser : styles.messageWrapperOther,
              ]}
            >
              <View
                style={[
                  styles.messageBubble,
                  message.isUser ? styles.messageBubbleUser : styles.messageBubbleOther,
                ]}
              >
                {message.image && (
                  <View style={styles.imageContainer}>
                    <Image
                      source={{ uri: message.image }}
                      style={styles.messageImage}
                      resizeMode="cover"
                    />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => handleRemoveImage(message.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="close" size={16} color={TEXT_PRIMARY} />
                    </TouchableOpacity>
                  </View>
                )}
                <Text
                  style={[
                    styles.messageText,
                    message.isUser ? styles.messageTextUser : styles.messageTextOther,
                  ]}
                >
                  {message.text}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Message Input Bar */}
        <View style={[styles.inputContainer, { paddingBottom: Platform.OS === 'ios' ? insets.bottom : 12 }]}>
          <TouchableOpacity
            style={styles.attachButton}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={24} color={TEXT_PRIMARY} />
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            placeholder="Type a message..."
            placeholderTextColor={TEXT_SECONDARY}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={styles.sendButton}
            onPress={handleSend}
            activeOpacity={0.7}
            disabled={!inputText.trim()}
          >
            <Ionicons
              name="send"
              size={20}
              color={inputText.trim() ? BACKGROUND_WHITE : TEXT_SECONDARY}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_WHITE,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 36,
  },
  keyboardView: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  messageWrapper: {
    marginBottom: 12,
    maxWidth: width * 0.75,
  },
  messageWrapperUser: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  messageWrapperOther: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
  },
  messageBubbleUser: {
    backgroundColor: '#E8F5E9',
    borderTopRightRadius: 4,
  },
  messageBubbleOther: {
    backgroundColor: '#FFF9E6',
    borderTopLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageTextUser: {
    color: TEXT_PRIMARY,
  },
  messageTextOther: {
    color: TEXT_PRIMARY,
  },
  imageContainer: {
    position: 'relative',
    marginBottom: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER_LIGHT,
    backgroundColor: BACKGROUND_WHITE,
  },
  attachButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    maxHeight: 100,
    fontSize: 15,
    color: TEXT_PRIMARY,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});

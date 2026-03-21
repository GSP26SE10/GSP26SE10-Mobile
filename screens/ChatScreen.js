import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_URL from '../constants/api';
import { getAccessToken } from '../utils/auth';
import * as signalR from '@microsoft/signalr';
import { TEXT_PRIMARY, BACKGROUND_WHITE, PRIMARY_COLOR, TEXT_SECONDARY, BORDER_LIGHT } from '../constants/colors';

const { width } = Dimensions.get('window');

export default function ChatScreen({ navigation }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [initializingConversation, setInitializingConversation] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [customerId, setCustomerId] = useState(null);
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [messagesHydrated, setMessagesHydrated] = useState(false);
  const insets = useSafeAreaInsets();
  const swipeBack = useSwipeBack(() => navigation.goBack());
  const connectionRef = React.useRef(null);
  const toHubConversationId = useCallback((raw) => {
    if (raw == null) return null;
    const str = String(raw).trim();
    if (!str) return null;
    return /^\d+$/.test(str) ? Number(str) : str;
  }, []);
  const hubConversationId = useMemo(
    () => toHubConversationId(conversationId),
    [conversationId, toHubConversationId],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setInitializingConversation(true);
        const raw = await AsyncStorage.getItem('userData');
        const user = raw ? JSON.parse(raw) : null;
        const userId = user?.userId ?? null;
        if (!userId) return;
        if (!cancelled) setCustomerId(userId);

        const key = `conversationId:${userId}`;
        const cached = await AsyncStorage.getItem(key);

        // 1) Ưu tiên lấy conversation có sẵn từ backend (đúng yêu cầu: rỗng mới POST tạo mới)
        let existingConversationId = null;
        try {
          const listRes = await fetch(
            `${API_URL}/api/conversation?CustomerId=${userId}&page=1&pageSize=10`,
          );
          const listJson = await listRes.json().catch(() => null);
          const items = Array.isArray(listJson?.items) ? listJson.items : [];
          const first = items[0];
          existingConversationId =
            first?.conversationId ?? first?.id ?? first?.data ?? null;
        } catch (e) {
          existingConversationId = null;
        }

        if (existingConversationId != null) {
          await AsyncStorage.setItem(key, String(existingConversationId));
          if (!cancelled) setConversationId(String(existingConversationId));
          return;
        }

        // fallback: nếu list rỗng nhưng đã cache (offline), dùng cache
        if (cached) {
          if (!cancelled) setConversationId(cached);
          return;
        }

        const payload = { customerId: Number(userId), ownerId: 1 };
        const res = await fetch(`${API_URL}/api/conversation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const text = await res.text();
        let json = null;
        try {
          json = text ? JSON.parse(text) : null;
        } catch {
          json = null;
        }
        const newId =
          json?.conversationId ??
          json?.data?.conversationId ??
          json?.data ??
          json?.id ??
          null;
        if (newId != null) {
          await AsyncStorage.setItem(key, String(newId));
          if (!cancelled) setConversationId(String(newId));
        }
      } catch (e) {
        // ignore init errors for now
      } finally {
        if (!cancelled) setInitializingConversation(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Connect SignalR and join conversation group
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!conversationId || !hubConversationId) return;
      const token = await getAccessToken();
      if (!token) return;

      // reuse connection if already built
      if (!connectionRef.current) {
        const conn = new signalR.HubConnectionBuilder()
          .withUrl(`${API_URL}/chatHub`, {
            accessTokenFactory: () => token,
          })
          .withAutomaticReconnect()
          .build();

        conn.onreconnecting(() => {
          if (!cancelled) setConnected(false);
        });
        const refreshMessagesFromServer = async () => {
          if (!conversationId || !customerId) return;
          try {
            const res = await fetch(
              `${API_URL}/api/message?ConversationId=${conversationId}&page=1&pageSize=30`,
            );
            const json = await res.json().catch(() => null);
            const items = Array.isArray(json?.items) ? json.items : [];
            const mapped = items
              .map((m) => {
                const sentAt = m?.sentAt ? new Date(m.sentAt) : null;
                const hhmm = sentAt
                  ? sentAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                  : '';
                return {
                  id: m?.messageId ?? `${m?.sentAt ?? ''}-${m?.senderId ?? ''}-${m?.content ?? ''}`,
                  text: String(m?.content ?? ''),
                  isUser: customerId != null ? Number(m?.senderId) === Number(customerId) : false,
                  timestamp: hhmm,
                };
              })
              .filter((m) => m.text);
            setMessages(mapped);
          } catch (_) {}
        };

        conn.onreconnected(async () => {
          if (cancelled) return;
          setConnected(true);
          try {
            await conn.invoke('JoinConversation', hubConversationId);
          } catch (e) {
            console.warn('JoinConversation failed after reconnect', e);
          }
          refreshMessagesFromServer();
        });
        conn.onclose(() => {
          if (!cancelled) setConnected(false);
        });

        conn.on('ReceiveMessage', (msg) => {
          try {
            const payload = msg?.data ?? msg;
            const senderId = payload?.senderId ?? payload?.fromUserId ?? payload?.userId ?? null;
            const content = payload?.content ?? payload?.message ?? payload?.text ?? '';
            if (!content) return;
            const sentAt = payload?.sentAt ? new Date(payload.sentAt) : new Date();
            const hhmm = sentAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
            const messageId = payload?.messageId ?? payload?.id ?? `rt-${Date.now()}`;
            const isUser = customerId != null && senderId != null ? Number(senderId) === Number(customerId) : false;

            setMessages((prev) => {
              // de-dupe by messageId if present
              if (prev.some((m) => String(m.id) === String(messageId))) return prev;
              return [
                ...prev,
                {
                  id: messageId,
                  text: String(content),
                  isUser,
                  timestamp: hhmm,
                },
              ];
            });
          } catch (e) {
            // Fallback sync when event shape is unexpected.
            refreshMessagesFromServer();
          }
        });

        connectionRef.current = conn;
      }

      const conn = connectionRef.current;
      const start = async () => {
        try {
          if (conn.state === signalR.HubConnectionState.Connected) return;
          await conn.start();
          if (cancelled) return;
          setConnected(true);
          await conn.invoke('JoinConversation', hubConversationId);
        } catch (e) {
          if (cancelled) return;
          setConnected(false);
          setTimeout(start, 5000);
        }
      };

      start();
    })();

    return () => {
      cancelled = true;
    };
  }, [conversationId, customerId, hubConversationId]);

  useEffect(() => {
    return () => {
      (async () => {
        try {
          if (connectionRef.current) {
            await connectionRef.current.stop();
            connectionRef.current = null;
          }
        } catch (e) {}
      })();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!conversationId) return;
      if (!customerId) return;

      // Hydrate messages from cache first (avoid flashing empty state)
      try {
        const cacheKey = `chatMessages:${customerId}:${conversationId}`;
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached && !cancelled) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) setMessages(parsed);
        }
      } catch (e) {
        // ignore
      } finally {
        if (!cancelled) setMessagesHydrated(true);
      }

      try {
        setLoadingMessages(true);
        const res = await fetch(
          `${API_URL}/api/message?ConversationId=${conversationId}&page=1&pageSize=10`,
        );
        const json = await res.json().catch(() => null);
        const items = Array.isArray(json?.items) ? json.items : [];
        const mapped = items
          .map((m) => {
            const sentAt = m?.sentAt ? new Date(m.sentAt) : null;
            const hhmm = sentAt
              ? sentAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
              : '';
            return {
              id: m?.messageId ?? `${m?.sentAt ?? ''}-${m?.senderId ?? ''}-${m?.content ?? ''}`,
              text: String(m?.content ?? ''),
              isUser: customerId != null ? Number(m?.senderId) === Number(customerId) : false,
              timestamp: hhmm,
            };
          })
          .filter((m) => m.text);

        // API thường trả theo thời gian tăng dần, nếu backend trả ngược thì đảo lại cho đúng.
        const sorted = [...mapped].sort((a, b) => {
          const aNum = typeof a.id === 'number' ? a.id : 0;
          const bNum = typeof b.id === 'number' ? b.id : 0;
          return aNum - bNum;
        });

        if (!cancelled) {
          setMessages(sorted);
          // Persist latest messages to cache per user+conversation
          try {
            const cacheKey = `chatMessages:${customerId}:${conversationId}`;
            await AsyncStorage.setItem(cacheKey, JSON.stringify(sorted));
          } catch (e) {}
        }
      } catch (e) {
        if (!cancelled && !messagesHydrated) setMessages([]);
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId, customerId]);

  const handleSend = async () => {
    const content = inputText.trim();
    if (!content) return;
    if (!conversationId || !customerId) return;
    if (sending) return;

    const tmpId = `tmp-${Date.now()}`;
    const now = new Date();
    const optimistic = {
      id: tmpId,
      text: content,
      isUser: true,
      timestamp: now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    setSending(true);
    setInputText('');
    setMessages((prev) => [...prev, optimistic]);

    try {
      const payload = {
        conversationId: hubConversationId,
        senderId: Number(customerId),
        content,
      };
      const res = await fetch(`${API_URL}/api/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }

      const data = json?.data ?? json;
      const messageId = data?.messageId ?? data?.id ?? null;
      const sentAt = data?.sentAt ? new Date(data.sentAt) : null;
      const timestamp = sentAt
        ? sentAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        : optimistic.timestamp;

      if (messageId != null) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tmpId
              ? { ...m, id: messageId, timestamp }
              : m,
          ),
        );
      }
    } catch (e) {
      // Nếu lỗi thì bỏ message optimistic để tránh gây nhầm
      setMessages((prev) => prev.filter((m) => m.id !== tmpId));
    } finally {
      setSending(false);
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
          {(messages.length === 0 && (!messagesHydrated || initializingConversation || loadingMessages)) && (
            <View style={{ paddingTop: 6 }}>
              {[1, 2, 3, 4, 5].map((i) => {
                const isUser = i % 2 === 0;
                return (
                  <View
                    key={`sk-${i}`}
                    style={[
                      styles.messageWrapper,
                      isUser ? styles.messageWrapperUser : styles.messageWrapperOther,
                    ]}
                  >
                    <View
                      style={[
                        styles.messageBubble,
                        isUser ? styles.messageBubbleUser : styles.messageBubbleOther,
                      ]}
                    >
                      <View
                        style={[
                          styles.skeletonLine,
                          { width: isUser ? 160 : 190, marginBottom: 8 },
                        ]}
                      />
                      <View
                        style={[
                          styles.skeletonLine,
                          { width: isUser ? 110 : 140 },
                        ]}
                      />
                      <View
                        style={[
                          styles.skeletonTime,
                          { alignSelf: isUser ? 'flex-end' : 'flex-start' },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
          {messages.length === 0 && messagesHydrated && !initializingConversation && !loadingMessages && (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>
                {initializingConversation
                  ? 'Đang khởi tạo cuộc trò chuyện...'
                  : loadingMessages
                  ? 'Đang tải tin nhắn...'
                  : 'Bắt đầu cuộc trò chuyện'}
              </Text>
             
            </View>
          )}
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
                {!!message.timestamp && (
                  <Text
                    style={[
                      styles.messageTime,
                      message.isUser ? styles.messageTimeUser : styles.messageTimeOther,
                    ]}
                  >
                    {message.timestamp}
                  </Text>
                )}
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
            placeholder="Nhập tin nhắn..."
            placeholderTextColor={TEXT_SECONDARY}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          {(() => {
            const canSend = !!inputText.trim() && !!conversationId && !!customerId && !sending;
            return (
              <TouchableOpacity
                style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
                onPress={handleSend}
                activeOpacity={0.7}
                disabled={!canSend}
              >
            <Ionicons
              name="send"
              size={20}
              color={canSend ? BACKGROUND_WHITE : TEXT_SECONDARY}
            />
              </TouchableOpacity>
            );
          })()}
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
  messageTime: {
    marginTop: 6,
    fontSize: 11,
    color: TEXT_SECONDARY,
  },
  messageTimeUser: {
    textAlign: 'right',
  },
  messageTimeOther: {
    textAlign: 'left',
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
  sendButtonDisabled: {
    backgroundColor: '#D3D3D3',
  },
  emptyWrap: {
    paddingTop: 30,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_SECONDARY,
    textAlign: 'center',
  },
  emptySub: {
    marginTop: 6,
    fontSize: 12,
    color: TEXT_SECONDARY,
    textAlign: 'center',
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E5E5E5',
  },
  skeletonTime: {
    marginTop: 8,
    width: 42,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E5E5E5',
    opacity: 0.8,
  },
});

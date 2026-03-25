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

const formatVnd = (value) => {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return '';
  return `${n.toLocaleString('vi-VN')}đ`;
};

const buildMessageFingerprint = ({ text, messageType, menuId, isUser }) => {
  return [
    isUser ? '1' : '0',
    String(messageType ?? 'TEXT').toUpperCase(),
    String(menuId ?? ''),
    String(text ?? '').trim(),
  ].join('|');
};

const normalizeMenuImage = (raw) => {
  let pick = raw;

  // API có thể trả JSONB dưới dạng string: "[\"https://...\", ...]"
  if (typeof pick === 'string') {
    const trimmed = pick.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        pick = JSON.parse(trimmed);
      } catch {
        pick = raw;
      }
    }
  }

  if (Array.isArray(pick)) {
    pick = pick[0];
  }

  if (pick && typeof pick === 'object') {
    pick = pick?.url ?? pick?.uri ?? pick?.image ?? pick?.imgUrl ?? null;
  }

  if (typeof pick !== 'string') return null;
  const uri = pick.trim();
  if (!uri) return null;
  // Chỉ chấp nhận uri mà RN Image xử lý ổn định
  if (
    uri.startsWith('http://') ||
    uri.startsWith('https://') ||
    uri.startsWith('file://') ||
    uri.startsWith('content://') ||
    uri.startsWith('data:image/')
  ) {
    return uri;
  }
  return null;
};

const normalizeMessageFromApi = (m, currentUserId) => {
  const sentAt = m?.sentAt ? new Date(m.sentAt) : null;
  const hhmm = sentAt
    ? sentAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : '';
  const messageType = String(
    m?.messageType ?? m?.type ?? m?.message_type ?? 'TEXT',
  ).toUpperCase();
  const menuIdRaw = m?.menuId ?? m?.MenuId ?? m?.menu?.menuId ?? null;
  const menuIdNum = Number(menuIdRaw);
  const menuPayload = menuIdRaw != null ? {
    menuId: Number.isNaN(menuIdNum) ? menuIdRaw : menuIdNum,
    name:
      m?.menuName ??
      m?.menu?.menuName ??
      m?.menu?.name ??
      null,
    price:
      m?.menuPrice ??
      m?.menu?.basePrice ??
      m?.menu?.price ??
      null,
    image:
      normalizeMenuImage(m?.menuImage) ??
      normalizeMenuImage(m?.menu?.imgUrl) ??
      normalizeMenuImage(m?.menu?.image) ??
      null,
  } : null;

  return {
    id: m?.messageId ?? `${m?.sentAt ?? ''}-${m?.senderId ?? ''}-${m?.content ?? ''}`,
    clientKey: m?.messageId != null
      ? `srv-${String(m.messageId)}`
      : `srv-${String(m?.sentAt ?? '')}-${String(m?.senderId ?? '')}-${String(m?.content ?? '')}`,
    text: String(m?.content ?? ''),
    isUser: currentUserId != null ? Number(m?.senderId) === Number(currentUserId) : false,
    timestamp: hhmm,
    messageType,
    menu: menuPayload,
  };
};

const dedupeMessagesById = (list) => {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const key = String(item?.id ?? '');
    if (!key) {
      out.push(item);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
};

export default function ChatScreen({ navigation, route }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [initializingConversation, setInitializingConversation] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [customerId, setCustomerId] = useState(null);
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [messagesHydrated, setMessagesHydrated] = useState(false);
  const [pendingMenuPreview, setPendingMenuPreview] = useState(null);
  const [loadingPendingMenu, setLoadingPendingMenu] = useState(false);
  const insets = useSafeAreaInsets();
  const swipeBack = useSwipeBack(() => navigation.goBack());
  const connectionRef = React.useRef(null);
  const hubConversationIdRef = React.useRef(null);
  const conversationIdRef = React.useRef(conversationId);
  const customerIdRef = React.useRef(customerId);
  const pendingOptimisticRef = React.useRef(new Map());
  const scrollViewRef = React.useRef(null);
  const shouldAutoScrollRef = React.useRef(true);
  const didInitialScrollRef = React.useRef(false);

  const scrollToBottom = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd?.({ animated });
    });
  }, []);

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

  React.useEffect(() => {
    hubConversationIdRef.current = hubConversationId;
  }, [hubConversationId]);
  React.useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);
  React.useEffect(() => {
    customerIdRef.current = customerId;
  }, [customerId]);

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
    let retryTimer = null;

    const hubBase = `${String(API_URL).replace(/\/$/, '')}/chatHub`;

    const refreshMessagesFromServer = async () => {
      const cid = conversationIdRef.current;
      const uid = customerIdRef.current;
      if (!cid || !uid) return;
      try {
        const res = await fetch(
          `${API_URL}/api/message?ConversationId=${cid}&page=1&pageSize=30`,
        );
        const json = await res.json().catch(() => null);
        const items = Array.isArray(json?.items) ? json.items : [];
        const mapped = items
          .map((m) => normalizeMessageFromApi(m, uid))
          .filter((m) => m.text || (m.messageType === 'MENU' && m.menu));
        if (!cancelled) setMessages(dedupeMessagesById(mapped));
      } catch (_) {}
    };

    const applyIncomingPayload = (raw) => {
      try {
        const payload =
          raw && typeof raw === 'object' && 'data' in raw ? raw.data : raw;
        const obj =
          payload && typeof payload === 'object'
            ? payload
            : typeof raw === 'string'
              ? { content: raw }
              : {};
        const senderId = obj?.senderId ?? obj?.fromUserId ?? obj?.userId ?? null;
        const content = obj?.content ?? obj?.message ?? obj?.text ?? '';
        const sentAt = obj?.sentAt ? new Date(obj.sentAt) : new Date();
        const hhmm = sentAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const messageId = obj?.messageId ?? obj?.id ?? `rt-${Date.now()}`;
        const messageType = String(
          obj?.messageType ?? obj?.type ?? obj?.message_type ?? 'TEXT',
        ).toUpperCase();
        const menuIdRaw = obj?.menuId ?? obj?.MenuId ?? obj?.menu?.menuId ?? null;
        const menuIdNum = Number(menuIdRaw);
        const menuPayload = menuIdRaw != null ? {
          menuId: Number.isNaN(menuIdNum) ? menuIdRaw : menuIdNum,
          name:
            obj?.menuName ??
            obj?.menu?.menuName ??
            obj?.menu?.name ??
            null,
          price:
            obj?.menuPrice ??
            obj?.menu?.basePrice ??
            obj?.menu?.price ??
            null,
          image:
            normalizeMenuImage(obj?.menuImage) ??
            normalizeMenuImage(obj?.menu?.imgUrl) ??
            normalizeMenuImage(obj?.menu?.image) ??
            null,
        } : null;
        const normalizedContent = String(content ?? '').trim();
        const isMenuMessage = messageType === 'MENU';
        if (!normalizedContent && !(isMenuMessage && menuPayload)) return;
        const uid = customerIdRef.current;
        const isUser =
          uid != null && senderId != null ? Number(senderId) === Number(uid) : false;
        const incomingFingerprint = buildMessageFingerprint({
          text: normalizedContent,
          messageType,
          menuId: menuPayload?.menuId ?? null,
          isUser,
        });

        setMessages((prev) => {
          if (prev.some((m) => String(m.id) === String(messageId))) return prev;

          // Tin nhắn của chính user: ưu tiên merge vào bubble optimistic để tránh nháy/remount
          if (isUser) {
            const now = Date.now();
            for (const [tmpId, pending] of pendingOptimisticRef.current.entries()) {
              if (now - pending.createdAt > 25000) {
                pendingOptimisticRef.current.delete(tmpId);
                continue;
              }
              if (pending.fingerprint !== incomingFingerprint) continue;
              const idx = prev.findIndex((m) => String(m.id) === String(tmpId));
              if (idx === -1) {
                pendingOptimisticRef.current.delete(tmpId);
                continue;
              }
              const next = [...prev];
              next[idx] = {
                ...next[idx],
                id: messageId,
                text: String(content ?? ''),
                timestamp: hhmm,
                messageType,
                menu: menuPayload,
              };
              pendingOptimisticRef.current.delete(tmpId);
              return dedupeMessagesById(next);
            }
          }

          return dedupeMessagesById([
            ...prev,
            {
              id: messageId,
              clientKey: `srv-${String(messageId)}`,
              text: String(content ?? ''),
              isUser,
              timestamp: hhmm,
                  messageType,
                  menu: menuPayload,
            },
          ]);
        });
      } catch (e) {
        refreshMessagesFromServer();
      }
    };

    (async () => {
      if (!conversationId || !hubConversationId) return;
      const token = await getAccessToken();
      if (!token) return;

      if (!connectionRef.current) {
        const conn = new signalR.HubConnectionBuilder()
          .withUrl(hubBase, {
            // Bắt buộc gọi lại storage mỗi lần negotiate / reconnect (tránh JWT hết hạn & tránh closure cũ)
            accessTokenFactory: () => getAccessToken().then((t) => t ?? ''),
            transport:
              signalR.HttpTransportType.WebSockets |
              signalR.HttpTransportType.LongPolling,
          })
          .withAutomaticReconnect()
          .build();

        conn.onreconnecting(() => {
          if (!cancelled) setConnected(false);
        });

        conn.onreconnected(async () => {
          if (cancelled) return;
          setConnected(true);
          try {
            const hid = hubConversationIdRef.current;
            if (hid != null && hid !== '') {
              await conn.invoke('JoinConversation', hid);
            }
          } catch (e) {
            if (__DEV__) console.warn('JoinConversation failed after reconnect', e);
          }
          refreshMessagesFromServer();
        });
        conn.onclose(() => {
          if (!cancelled) setConnected(false);
        });

        const onMessage = (...args) => {
          const raw = args.length > 1 ? args : args[0];
          applyIncomingPayload(raw);
        };
        conn.on('ReceiveMessage', onMessage);
        // Một số cấu hình server / protocol dùng camelCase
        conn.on('receiveMessage', onMessage);

        connectionRef.current = conn;
      }

      const conn = connectionRef.current;
      const joinConversation = async () => {
        const hid = hubConversationIdRef.current;
        if (hid == null || hid === '') return;
        try {
          await conn.invoke('JoinConversation', hid);
        } catch (e) {
          if (__DEV__) console.warn('JoinConversation failed', e);
        }
      };

      const start = async () => {
        if (cancelled) return;
        try {
          if (conn.state !== signalR.HubConnectionState.Connected) {
            await conn.start();
            if (cancelled) return;
            setConnected(true);
          }
          // Luôn join lại khi đã Connected: effect có thể chạy lại (đổi conversation) mà trước đây bị return sớm
          await joinConversation();
        } catch (e) {
          if (cancelled) return;
          setConnected(false);
          if (__DEV__) console.warn('SignalR start error', e);
          retryTimer = setTimeout(start, 5000);
        }
      };

      start();
    })();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
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
    // Đổi conversation thì reset hành vi auto-scroll
    didInitialScrollRef.current = false;
    shouldAutoScrollRef.current = true;
  }, [conversationId]);

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
          .map((m) => normalizeMessageFromApi(m, customerId))
          .filter((m) => m.text || (m.messageType === 'MENU' && m.menu));

        // API thường trả theo thời gian tăng dần, nếu backend trả ngược thì đảo lại cho đúng.
        const sorted = [...mapped].sort((a, b) => {
          const aNum = typeof a.id === 'number' ? a.id : 0;
          const bNum = typeof b.id === 'number' ? b.id : 0;
          return aNum - bNum;
        });

        if (!cancelled) {
          setMessages(dedupeMessagesById(sorted));
          // Persist latest messages to cache per user+conversation
          try {
            const cacheKey = `chatMessages:${customerId}:${conversationId}`;
            await AsyncStorage.setItem(cacheKey, JSON.stringify(dedupeMessagesById(sorted)));
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

  useEffect(() => {
    // Sau khi hydrate/xong tải lần đầu: luôn nhảy xuống cuối để thấy tin mới nhất
    if (!messagesHydrated || initializingConversation || loadingMessages) return;
    if (!messages.length) return;
    if (!didInitialScrollRef.current) {
      didInitialScrollRef.current = true;
      scrollToBottom(false);
    }
  }, [messagesHydrated, initializingConversation, loadingMessages, messages.length, scrollToBottom]);

  useEffect(() => {
    // Tin nhắn mới đến: chỉ auto-scroll nếu user đang ở gần cuối
    if (!messagesHydrated || !messages.length) return;
    if (shouldAutoScrollRef.current) {
      scrollToBottom(true);
    }
  }, [messages, messagesHydrated, scrollToBottom]);

  const sendMessage = async ({ content, messageType, menuId, menuPayload, clearInput = false }) => {
    if (!conversationId || !customerId) return false;
    const safeContent = String(content ?? '').trim();
    if (!safeContent) return false;
    const msgType = String(messageType ?? 'TEXT').toUpperCase();
    const tmpId = `tmp-${Date.now()}`;
    const now = new Date();
    const optimistic = {
      id: tmpId,
      clientKey: tmpId,
      text: safeContent,
      isUser: true,
      timestamp: now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      messageType: msgType,
      menu: menuPayload ?? null,
    };
    const optimisticFingerprint = buildMessageFingerprint({
      text: safeContent,
      messageType: msgType,
      menuId: menuId == null ? null : Number(menuId),
      isUser: true,
    });

    setSending(true);
    if (clearInput) setInputText('');
    setMessages((prev) => dedupeMessagesById([...prev, optimistic]));
    pendingOptimisticRef.current.set(tmpId, {
      fingerprint: optimisticFingerprint,
      createdAt: Date.now(),
    });
    try {
      const payload = {
        conversationId: hubConversationId,
        senderId: Number(customerId),
        content: safeContent,
        messageType: msgType,
        menuId: menuId == null ? null : Number(menuId),
      };
      const requestBody = JSON.stringify(payload);
      console.log('[chat/send] body', requestBody);
      const res = await fetch(`${API_URL}/api/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
      });
      const responseText = await res.text();
      let json = null;
      try {
        json = responseText ? JSON.parse(responseText) : null;
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
          dedupeMessagesById(prev.map((m) =>
            m.id === tmpId
              ? { ...m, id: messageId, timestamp }
              : m,
          )),
        );
      }
      pendingOptimisticRef.current.delete(tmpId);
      return true;
    } catch (e) {
      // Nếu lỗi thì bỏ message optimistic để tránh gây nhầm
      setMessages((prev) => prev.filter((m) => m.id !== tmpId));
      pendingOptimisticRef.current.delete(tmpId);
      return false;
    } finally {
      setSending(false);
    }
  };

  const handleSend = async () => {
    const content = inputText.trim();
    if (!content || sending) return;
    const hasPendingMenu = !!pendingMenuPreview?.menuId;
    await sendMessage({
      content,
      messageType: hasPendingMenu ? 'MENU' : 'TEXT',
      menuId: hasPendingMenu ? pendingMenuPreview.menuId : null,
      menuPayload: hasPendingMenu ? pendingMenuPreview : null,
      clearInput: true,
    });
    if (hasPendingMenu) {
      setPendingMenuPreview(null);
    }
  };

  useEffect(() => {
    const params = route?.params ?? {};
    const intentMenuIdRaw = params?.menuId;
    const intentMenuIdNum = Number(intentMenuIdRaw);
    if (intentMenuIdRaw == null || Number.isNaN(intentMenuIdNum)) return;
    let cancelled = false;

    (async () => {
      try {
        setLoadingPendingMenu(true);
        const res = await fetch(
          `${API_URL}/api/menu?MenuId=${intentMenuIdNum}&page=1&pageSize=10`,
        );
        const json = await res.json().catch(() => null);
        const first = Array.isArray(json?.items) ? json.items[0] : null;
        if (cancelled) return;
        const fallbackName = `Menu #${intentMenuIdNum}`;
        const preview = {
          menuId: intentMenuIdNum,
          name: first?.menuName ?? fallbackName,
          price: first?.basePrice ?? null,
          image: normalizeMenuImage(first?.imgUrl),
        };
        setPendingMenuPreview(preview);
      } catch (_) {
        if (cancelled) return;
        setPendingMenuPreview({
          menuId: intentMenuIdNum,
          name: `Menu #${intentMenuIdNum}`,
          price: null,
          image: null,
        });
      } finally {
        if (!cancelled) setLoadingPendingMenu(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [route?.params?.menuId]);

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
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScroll={(event) => {
            const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
            const distanceToBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
            shouldAutoScrollRef.current = distanceToBottom < 80;
          }}
          scrollEventThrottle={16}
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
          {messages.map((message, index) => (
            <View
              key={String(message.clientKey ?? message.id ?? index)}
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
                {message.messageType === 'MENU' && message.menu ? (
                  <>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={styles.menuCard}
                      onPress={() => {
                        if (!message.menu?.menuId) return;
                        navigation.navigate('MenuDetail', {
                          menuId: message.menu.menuId,
                          menuName: message.menu?.name,
                        });
                      }}
                    >
                      {typeof message.menu?.image === 'string' && message.menu.image ? (
                        <Image
                          source={{ uri: message.menu.image }}
                          style={styles.menuCardImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.menuCardImage, styles.menuCardImagePlaceholder]}>
                          <Ionicons name="image-outline" size={20} color={TEXT_SECONDARY} />
                        </View>
                      )}
                      <View style={styles.menuCardInfo}>
                        <Text style={styles.menuCardTitle} numberOfLines={2}>
                          {message.menu?.name || `Menu #${message.menu?.menuId ?? ''}`}
                        </Text>
                        <Text style={styles.menuCardPrice}>
                          {formatVnd(message.menu?.price) || ' '}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    {!!String(message.text ?? '').trim() && (
                      <Text
                        style={[
                          styles.messageText,
                          styles.menuMessageText,
                          message.isUser ? styles.messageTextUser : styles.messageTextOther,
                        ]}
                      >
                        {message.text}
                      </Text>
                    )}
                  </>
                ) : (
                  <Text
                    style={[
                      styles.messageText,
                      message.isUser ? styles.messageTextUser : styles.messageTextOther,
                    ]}
                  >
                    {message.text}
                  </Text>
                )}
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

        {(loadingPendingMenu || pendingMenuPreview) && (
          <View style={styles.pendingMenuWrap}>
            <View style={styles.pendingMenuHeader}>
              <Text style={styles.pendingMenuHeaderText}>
                Bạn đang trao đổi về menu này
              </Text>
              {!!pendingMenuPreview && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setPendingMenuPreview(null)}
                  style={styles.pendingMenuClose}
                >
                  <Ionicons name="close" size={22} color={TEXT_SECONDARY} />
                </TouchableOpacity>
              )}
            </View>
            {loadingPendingMenu ? (
              <View style={[styles.pendingMenuCard, { justifyContent: 'center', height: 84 }]}>
                <Text style={styles.pendingMenuLoadingText}>Đang tải thông tin menu...</Text>
              </View>
            ) : pendingMenuPreview ? (
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.pendingMenuCard}
                onPress={() =>
                  navigation.navigate('MenuDetail', {
                    menuId: pendingMenuPreview.menuId,
                    menuName: pendingMenuPreview.name,
                  })
                }
              >
                {pendingMenuPreview.image ? (
                  <Image
                    source={{ uri: pendingMenuPreview.image }}
                    style={styles.pendingMenuImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.pendingMenuImage, styles.menuCardImagePlaceholder]}>
                    <Ionicons name="image-outline" size={20} color={TEXT_SECONDARY} />
                  </View>
                )}
                <View style={styles.pendingMenuInfo}>
                  <Text style={styles.pendingMenuName} numberOfLines={2}>
                    {pendingMenuPreview.name}
                  </Text>
                  <Text style={styles.pendingMenuPrice}>
                    {formatVnd(pendingMenuPreview.price)}
                  </Text>
                </View>
              </TouchableOpacity>
            ) : null}
          </View>
        )}

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
  pendingMenuWrap: {
    marginHorizontal: 12,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  pendingMenuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  pendingMenuHeaderText: {
    fontSize: 14,
    color: '#6A6A6A',
    flex: 1,
    paddingRight: 8,
  },
  pendingMenuClose: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingMenuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ECECEC',
    padding: 8,
  },
  pendingMenuImage: {
    width: 70,
    height: 70,
    borderRadius: 10,
    backgroundColor: '#EFEFEF',
  },
  pendingMenuInfo: {
    flex: 1,
    marginLeft: 10,
  },
  pendingMenuName: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  pendingMenuPrice: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '700',
    color: PRIMARY_COLOR,
  },
  pendingMenuLoadingText: {
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ECECEC',
    padding: 8,
    minWidth: 230,
  },
  menuCardImage: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: '#EFEFEF',
  },
  menuCardImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuCardInfo: {
    flex: 1,
    marginLeft: 10,
  },
  menuCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  menuCardPrice: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
    color: PRIMARY_COLOR,
  },
  menuMessageText: {
    marginTop: 8,
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

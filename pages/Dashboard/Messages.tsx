
import React, { useEffect, useState, useRef } from 'react';
import {
  WifiOff, Search, MessageSquare, ArrowRight, MoreVertical,
  Trash2, CheckCheck, AlertCircle, Clock, Plus, Send, StopCircle, Mic,
  UserPlus, X, Check, Users
} from 'lucide-react';
import { azureService } from '../../services/azureService';
import { realtimeService } from '../../services/realtimeService';
import { ChatConversation, ChatMessage, ChatRequest, UserSuggestion } from '../../types';
import { authService } from '../../services/authService';
import { toastService } from '../../services/toastService';
import { safeStorage } from '../../utils/safeStorage';

// Type definitions for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionConstructor {
  new(): SpeechRecognition;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  start(): void;
  stop(): void;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const Messages: React.FC = () => {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // User search for new chat request
  const [searchQuery, setSearchQuery] = useState('');
  const [userResults, setUserResults] = useState<UserSuggestion[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [sendingRequestTo, setSendingRequestTo] = useState<string | null>(null);
  const [showUserSearch, setShowUserSearch] = useState(false);

  // Incoming chat requests
  const [chatRequests, setChatRequests] = useState<ChatRequest[]>([]);
  const [acceptingRequestId, setAcceptingRequestId] = useState<string | null>(null);

  // Conversation search (filter existing)
  const [convoSearch, setConvoSearch] = useState('');

  useEffect(() => {
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
      };
  }, []);

  const scrollToBottom = () => {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  // Load Conversations
  const loadConvos = async () => {
      try {
          const data = await azureService.getConversations();

          // Check for a pending chat context stored by ProductDetail navigation.
          // safeStorage falls back: localStorage → sessionStorage → in-memory.
          const pendingChatStr = safeStorage.getItem('pending_chat');
          if (pendingChatStr) {
              try {
                  safeStorage.removeItem('pending_chat');
                  const pendingChat = JSON.parse(pendingChatStr) as {
                      id: string;
                      otherUserId: string;
                      otherUserName: string;
                      productId: string;
                      productTitle: string;
                  };
                  // Add a temporary conversation entry if not already present
                  if (!data.some(c => c.id === pendingChat.id)) {
                      data.unshift({
                          id: pendingChat.id,
                          otherUserId: pendingChat.otherUserId,
                          otherUserName: pendingChat.otherUserName,
                          otherUserAvatar: '',
                          productId: pendingChat.productId,
                          productTitle: pendingChat.productTitle,
                          lastMessage: '',
                          lastMessageTime: '',
                          unreadCount: 0,
                      });
                  }
                  setConversations(data);
                  setActiveChatId(pendingChat.id);
                  return;
              } catch { /* ignore parse errors */ }
          }

          setConversations(data);
      } catch {
          setConversations([]);
      }
  };

  const loadChatRequests = async () => {
      const data = await azureService.getChatRequests();
      setChatRequests(data);
  };

  useEffect(() => {
    // Ensure WebSocket is connected when the user opens the Messages page
    // (handles the case where the service loaded before the user logged in)
    realtimeService.connect();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadConvos();
    loadChatRequests();

    // Subscribe to Realtime Updates
    const unsubscribe = realtimeService.subscribe((incomingMsg) => {
        // Only add the message to the current thread if it's from the active conversation.
        if (activeChatId && incomingMsg.senderId === activeChatId) {
            setMessages(prev => {
                if (prev.some(m => m.id === incomingMsg.id)) return prev;
                return [...prev, incomingMsg];
            });
            scrollToBottom();
        }
        loadConvos();
    });

    // Listen for chat-request-accepted event (mock auto-accept)
    const handleRequestAccepted = () => {
        loadConvos();
        toastService.success('درخواست گفتگو پذیرفته شد!');
    };
    window.addEventListener('chat-request-accepted', handleRequestAccepted);

    return () => {
        unsubscribe();
        window.removeEventListener('chat-request-accepted', handleRequestAccepted);
    }
  }, [activeChatId]);

  useEffect(() => {
      if (activeChatId) {
          azureService.getMessages(activeChatId).then(data => {
              setMessages(data);
              scrollToBottom();
          });
      }
  }, [activeChatId]);

  // User search as user types
  useEffect(() => {
      const timer = setTimeout(async () => {
          if (searchQuery.length < 2) {
              setUserResults([]);
              return;
          }
          setIsSearchingUsers(true);
          const results = await azureService.searchUsers(searchQuery);
          setUserResults(results);
          setIsSearchingUsers(false);
      }, 300);
      return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSendChatRequest = async (user: UserSuggestion) => {
      setSendingRequestTo(user.id);
      const success = await azureService.sendChatRequest(user.id, user.name);
      setSendingRequestTo(null);
      if (success) {
          toastService.success(`درخواست گفتگو به ${user.name} ارسال شد.`);
          setSearchQuery('');
          setUserResults([]);
      }
  };

  const handleAcceptRequest = async (req: ChatRequest) => {
      setAcceptingRequestId(req.id);
      const convoId = await azureService.acceptChatRequest(req.id);
      setAcceptingRequestId(null);
      if (convoId) {
          await loadConvos();
          await loadChatRequests();
          setActiveChatId(convoId);
          toastService.success('گفتگو شروع شد!');
      }
  };

  const handleRejectRequest = async (req: ChatRequest) => {
      await azureService.rejectChatRequest(req.id);
      await loadChatRequests();
  };

  const handleSendMessage = async () => {
      if (!activeChatId || !newMessage.trim()) return;
      
      const tempId = `temp_${Date.now()}`;
      const tempMsg: ChatMessage = {
          id: tempId,
          senderId: authService.getCurrentUser()?.id || 'user_123',
          text: newMessage,
          type: 'TEXT',
          timestamp: new Date().toLocaleTimeString('fa-AF', { hour: '2-digit', minute: '2-digit' }),
          isRead: false,
          status: 'PENDING',
          isDeleted: false
      };

      setMessages(prev => [...prev, tempMsg]);
      setNewMessage('');
      scrollToBottom();

      const sentViaSocket = realtimeService.sendMessage(activeChatId, tempMsg.text);
      
      if (!sentViaSocket) {
          try {
            const sentMsg = await azureService.sendMessage(activeChatId, tempMsg.text);
            if (sentMsg) {
                setMessages(prev => prev.map(m => m.id === tempId ? { ...sentMsg, status: 'SENT' } : m));
                loadConvos();
            }
          } catch (error) {
            console.error("Failed to send message:", error);
            setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'FAILED' } : m));
          }
      } else {
          setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'SENT' } : m));
      }
  };

  const handleDeleteMessage = async (msgId: string) => {
      if (!confirm('آیا از حذف این پیام اطمینان دارید؟')) return;
      
      const success = await azureService.deleteMessage(msgId);
      if (success) {
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isDeleted: true } : m));
      }
  };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        toastService.warning('مرورگر شما از قابلیت تبدیل صدا به متن پشتیبانی نمی‌کند.');
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'fa-AF'; // Dari/Persian
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    
    recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        setNewMessage(prev => (prev ? prev + ' ' + transcript : transcript));
    };
    recognition.start();
  };

  const activeConversation = conversations.find(c => c.id === activeChatId);
  const filteredConversations = convoSearch
      ? conversations.filter(c =>
          c.otherUserName.toLowerCase().includes(convoSearch.toLowerCase()) ||
          c.productTitle.toLowerCase().includes(convoSearch.toLowerCase()))
      : conversations;

  return (
    <div className="bg-ui-surface rounded-2xl shadow-sm border border-ui-border overflow-hidden h-[calc(100vh-140px)] min-h-[500px] flex">
      {/* Sidebar */}
      <div className={`w-full md:w-80 border-l border-ui-border flex flex-col ${activeChatId ? 'hidden md:flex' : 'flex'}`}>
         {!isOnline && (
             <div className="bg-yellow-50 text-yellow-700 text-xs p-2 text-center flex items-center justify-center gap-2">
                 <WifiOff className="w-3 h-3" />
                 <span>شما آفلاین هستید</span>
             </div>
         )}
         <div className="p-4 border-b border-ui-border bg-ui-surface2/50">
            <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-ui-text">پیام‌ها</h2>
                <button
                    onClick={() => { setShowUserSearch(v => !v); setSearchQuery(''); setUserResults([]); }}
                    className={`p-1.5 rounded-lg transition-colors ${showUserSearch ? 'text-white bg-brand-600' : 'text-brand-600 hover:bg-brand-50'}`}
                    title="گفتگوی جدید"
                >
                    <UserPlus className="w-4 h-4" />
                </button>
            </div>

            {/* User search for new chat request */}
            {showUserSearch && (
            <div className="relative mb-2">
               <input
                 type="text"
                 value={searchQuery}
                 onChange={e => setSearchQuery(e.target.value)}
                 placeholder="جستجوی کاربر برای گفتگو..."
                 className="w-full bg-ui-surface border border-ui-border rounded-xl pr-9 pl-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                 autoFocus
               />
               {isSearchingUsers
                 ? <div className="absolute right-3 top-3 w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                 : <Search className="absolute right-3 top-3 w-4 h-4 text-ui-muted" />
               }
               {searchQuery && (
                   <button onClick={() => { setSearchQuery(''); setUserResults([]); }} className="absolute left-2.5 top-2.5 text-ui-muted hover:text-ui-text p-0.5 rounded">
                       <X className="w-4 h-4" />
                   </button>
               )}
            </div>
            )}

            {/* User search results dropdown */}
            {showUserSearch && userResults.length > 0 && (
                <div className="bg-ui-surface border border-ui-border rounded-xl shadow-lg overflow-hidden mb-2">
                    {userResults.map(user => (
                        <div key={user.id} className="flex items-center justify-between p-3 hover:bg-ui-surface2 border-b border-gray-50 last:border-0">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center text-brand-600 font-bold text-sm">
                                    {user.name.charAt(0)}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-ui-text">{user.name}</p>
                                    {user.province && <p className="text-xs text-ui-muted">{user.province}</p>}
                                </div>
                            </div>
                            <button
                                onClick={() => handleSendChatRequest(user)}
                                disabled={sendingRequestTo === user.id}
                                className="text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                            >
                                {sendingRequestTo === user.id
                                    ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    : <UserPlus className="w-3 h-3" />
                                }
                                درخواست
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Conversation filter */}
            {conversations.length > 0 && !showUserSearch && (
                <div className="relative">
                    <input
                        type="text"
                        value={convoSearch}
                        onChange={e => setConvoSearch(e.target.value)}
                        placeholder="فیلتر گفتگوها..."
                        className="w-full bg-ui-surface border border-ui-border rounded-xl pr-9 pl-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <Users className="absolute right-3 top-2.5 w-4 h-4 text-ui-muted" />
                </div>
            )}
         </div>
         <div className="flex-1 overflow-y-auto">
            {/* Incoming chat requests */}
            {chatRequests.length > 0 && (
                <div className="border-b border-ui-border">
                    <p className="text-[10px] font-bold text-ui-muted uppercase px-4 pt-3 pb-1">درخواست‌های گفتگو ({chatRequests.length})</p>
                    {chatRequests.map(req => (
                        <div key={req.id} className="px-4 py-3 flex items-center gap-3 border-b border-gray-50 bg-brand-50/50">
                            <div className="w-9 h-9 bg-brand-100 rounded-full flex-shrink-0 flex items-center justify-center text-brand-600 font-bold text-sm">
                                {req.fromUserName.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm text-ui-text truncate">{req.fromUserName}</p>
                                <p className="text-[10px] text-ui-muted">{req.createdAt}</p>
                            </div>
                            <div className="flex gap-1.5">
                                <button
                                    onClick={() => handleAcceptRequest(req)}
                                    disabled={acceptingRequestId === req.id}
                                    className="p-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
                                    title="قبول"
                                >
                                    {acceptingRequestId === req.id
                                        ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        : <Check className="w-3 h-3" />
                                    }
                                </button>
                                <button
                                    onClick={() => handleRejectRequest(req)}
                                    className="p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                                    title="رد"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {filteredConversations.length === 0 && !showUserSearch ? (
                <div className="flex flex-col items-center justify-center h-full text-ui-muted text-sm p-4">
                    <MessageSquare className="w-10 h-10 mb-2 opacity-30" />
                    <p>هیچ گفتگویی ندارید.</p>
                    <p className="text-xs mt-1 text-center">برای شروع گفتگو، روی آیکون + کلیک کنید</p>
                </div>
            ) : filteredConversations.length === 0 && showUserSearch ? (
                <div className="p-4 text-center text-sm text-ui-muted">نتیجه‌ای یافت نشد.</div>
            ) : (
                filteredConversations.map(conv => (
                <div key={conv.id} onClick={() => setActiveChatId(conv.id)} className={`p-4 flex gap-3 hover:bg-ui-surface2 cursor-pointer border-b border-gray-50 transition-colors ${activeChatId === conv.id ? 'bg-brand-50 border-r-4 border-r-brand-500' : ''}`}>
                    <div className="w-12 h-12 bg-ui-surface2 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-ui-muted relative">
                        {conv.otherUserName.charAt(0)}
                        {/* Fake Online Indicator */}
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between mb-1">
                            <h4 className="font-bold text-sm truncate text-ui-text">{conv.otherUserName}</h4>
                            <span className="text-[10px] text-ui-muted">{conv.lastMessageTime}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <p className="text-xs text-ui-muted truncate max-w-[150px]">{conv.lastMessage}</p>
                            {conv.unreadCount > 0 && (
                                <span className="bg-brand-600 text-white text-[10px] font-bold px-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full">
                                    {conv.unreadCount}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                ))
            )}
         </div>
      </div>

      {/* Chat Area */}
      <div className={`w-full md:flex-1 flex flex-col bg-ui-surface2/30 ${!activeChatId ? 'hidden md:flex' : 'flex'}`}>
         {activeChatId && activeConversation ? (
            <>
               <div className="p-3 border-b border-ui-border flex items-center justify-between bg-ui-surface z-10 shadow-sm h-[72px]">
                  <div className="flex items-center gap-3">
                     <button onClick={() => setActiveChatId(null)} className="md:hidden text-ui-muted p-2 -mr-2 hover:bg-ui-surface2 rounded-full"><ArrowRight className="w-6 h-6" /></button>
                     <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center text-brand-600 font-bold relative">
                        {activeConversation.otherUserName.charAt(0)}
                        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>
                     </div>
                     <div>
                        <h3 className="font-bold text-ui-text text-sm flex items-center gap-2">
                            {activeConversation.otherUserName}
                            <span className="text-[10px] font-normal text-green-600 bg-green-50 px-1.5 rounded">آنلاین</span>
                        </h3>
                        <p className="text-xs text-ui-muted truncate max-w-[200px] flex items-center gap-1">
                            <span className="opacity-70">درباره:</span> {activeConversation.productTitle}
                        </p>
                     </div>
                  </div>
                  <button className="text-ui-muted p-2 hover:bg-ui-surface2 rounded-full"><MoreVertical className="w-5 h-5" /></button>
               </div>

               <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.map((msg, idx) => {
                     const isMe = msg.senderId === (authService.getCurrentUser()?.id || 'user_123');
                     return (
                        <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group animate-in slide-in-from-bottom-2 duration-300`}>
                           <div className={`max-w-[75%] p-3 rounded-2xl text-sm relative shadow-sm ${isMe ? 'bg-brand-600 text-white rounded-br-none' : 'bg-ui-surface text-ui-text border border-ui-border rounded-bl-none'}`}>
                              
                              {msg.isDeleted ? (
                                  <p className="italic opacity-60 text-xs flex items-center gap-1">
                                      <Trash2 className="w-3 h-3" />
                                      این پیام حذف شده است.
                                  </p>
                              ) : (
                                  <>
                                    <p className="leading-relaxed">{msg.text}</p>
                                    {isMe && (
                                        <button 
                                            onClick={() => handleDeleteMessage(msg.id)}
                                            className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-black/20 rounded-full hover:bg-black/40 text-white"
                                            title="حذف پیام"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    )}
                                  </>
                              )}

                              <div className={`text-[10px] mt-1 flex items-center gap-1 justify-end ${isMe ? 'text-brand-100' : 'text-ui-muted'}`}>
                                 <span>{msg.timestamp}</span>
                                 {isMe && !msg.isDeleted && (
                                     msg.status === 'SENT' ? <CheckCheck className="w-3 h-3"/> : 
                                     msg.status === 'FAILED' ? <AlertCircle className="w-3 h-3 text-red-300"/> :
                                     <Clock className="w-3 h-3"/>
                                 )}
                              </div>
                           </div>
                        </div>
                     );
                  })}
                  <div ref={messagesEndRef} />
               </div>

               <div className="p-3 bg-ui-surface border-t border-ui-border flex gap-2 items-end">
                   <button className="p-3 text-ui-muted hover:bg-ui-surface2 rounded-full transition-colors"><Plus className="w-5 h-5 text-ui-muted" /></button>
                   <input 
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      className="flex-1 bg-ui-surface2 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-500 transition-shadow"
                      placeholder={isListening ? 'در حال گوش دادن...' : 'پیام خود را بنویسید...'}
                   />
                   {newMessage.trim() ? (
                       <button onClick={handleSendMessage} className="p-3 bg-brand-600 text-white rounded-full hover:bg-brand-700 shadow-md transform active:scale-95 transition-all">
                           <Send className="w-5 h-5 rtl:-rotate-90 text-white" />
                       </button>
                   ) : (
                       <button 
                        onClick={startListening} 
                        className={`p-3 rounded-full transition-all ${isListening ? 'bg-red-50 text-red-500 animate-pulse border border-red-200' : 'bg-ui-surface2 text-ui-muted hover:bg-ui-surface2'}`}
                        title="تبدیل صدا به متن"
                       >
                           {isListening ? <StopCircle className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                       </button>
                   )}
               </div>
            </>
         ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-ui-muted p-8">
               <div className="w-20 h-20 bg-ui-surface2 rounded-full flex items-center justify-center mb-4">
                   <MessageSquare className="w-10 h-10 opacity-30" />
               </div>
               <p className="font-bold text-ui-muted">گفتگویی انتخاب نشده است</p>
               <p className="text-xs mt-2">برای شروع چت، یک مخاطب را انتخاب کنید</p>
            </div>
         )}
      </div>
    </div>
  );
};

export default Messages;

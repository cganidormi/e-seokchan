'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/supabaseClient';
import toast from 'react-hot-toast';
import { IoClose, IoSend } from 'react-icons/io5';
import { BsChatDotsFill } from 'react-icons/bs';

export interface ChatMessage {
  id: number;
  sender_role: 'student' | 'teacher';
  sender_name: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface DongheonChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRole: 'student' | 'teacher';
  currentName: string;
}

export default function DongheonChatModal({
  isOpen,
  onClose,
  currentRole,
  currentName,
}: DongheonChatModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 스크롤 맨 아래로 이동
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // 1. 상대방 메시지 읽음 처리 함수
  const markAsRead = async () => {
    try {
      const oppositeRole = currentRole === 'student' ? 'teacher' : 'student';
      await supabase
        .from('dongheon_chats')
        .update({ is_read: true })
        .eq('sender_role', oppositeRole)
        .eq('is_read', false);
    } catch (e) {
      console.error('Failed to mark as read:', e);
    }
  };

  // 2. 메시지 목록 불러오기
  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('dongheon_chats')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(200);

      if (error) {
        // 테이블이 아직 없거나 쿼리 실패 시
        console.warn('Chat fetch warning:', error.message);
        return;
      }

      if (data) {
        setMessages(data as ChatMessage[]);
        if (isOpen) {
          markAsRead();
        }
      }
    } catch (err) {
      console.error('Error fetching chat messages:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    fetchMessages();

    // 3. 실시간 Realtime 구독 설정
    const channel = supabase
      .channel('dongheon_chats_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'dongheon_chats' },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessages((prev) => {
            // 중복 방지
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });

          // 내가 보고 있는 중에 상대방이 보낸 거라면 즉시 읽음 처리
          if (newMsg.sender_role !== currentRole) {
            markAsRead();
          }

          setTimeout(() => scrollToBottom('smooth'), 100);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'dongheon_chats' },
        (payload) => {
          const updated = payload.new as ChatMessage;
          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? updated : m))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, currentRole]);

  // 모달이 열리거나 메시지가 추가될 때 자동 스크롤
  useEffect(() => {
    if (isOpen && messages.length > 0) {
      setTimeout(() => scrollToBottom('auto'), 150);
    }
  }, [isOpen, messages.length]);

  // 푸시 알림 발송 헬퍼
  const sendPushNotification = async (text: string) => {
    try {
      if (currentRole === 'student') {
        // 학생 -> 이상찬 관리자님에게 푸시 발송
        const { data: teacherData } = await supabase
          .from('teachers')
          .select('id')
          .eq('name', '이상찬')
          .single();

        if (teacherData?.id) {
          const { data: subs } = await supabase
            .from('push_subscriptions')
            .select('subscription_json')
            .eq('teacher_id', teacherData.id);

          if (subs && subs.length > 0) {
            subs.forEach((sub) => {
              fetch('/api/web-push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  subscription: sub.subscription_json,
                  title: '💬 [동헌이 톡] 새 메시지 도착',
                  message: `강동헌: "${text.length > 30 ? text.slice(0, 30) + '...' : text}"`,
                }),
              }).catch((e) => console.error('Push error:', e));
            });
          }
        }
      } else {
        // 선생님 -> 강동헌 학생에게 푸시 발송
        const { data: subs } = await supabase
          .from('push_subscriptions')
          .select('subscription_json')
          .eq('student_id', '2101강동헌');

        if (subs && subs.length > 0) {
          subs.forEach((sub) => {
            fetch('/api/web-push', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                subscription: sub.subscription_json,
                title: '💌 [이상찬 쌤] 답장이 도착했습니다',
                message: text.length > 30 ? text.slice(0, 30) + '...' : text,
              }),
            }).catch((e) => console.error('Push error:', e));
          });
        }
      }
    } catch (err) {
      console.error('Push sending error:', err);
    }
  };

  // 4. 메시지 전송
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || isSending) return;

    try {
      setIsSending(true);

      const newRecord = {
        sender_role: currentRole,
        sender_name: currentName,
        message: trimmed,
        is_read: false,
      };

      const { data, error } = await supabase
        .from('dongheon_chats')
        .insert([newRecord])
        .select()
        .single();

      if (error) {
        throw error;
      }

      setInputText('');

      // 즉시 로컬 state 반영 (Realtime 대기 전 반응성 강화)
      if (data) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.id)) return prev;
          return [...prev, data as ChatMessage];
        });
      }

      setTimeout(() => scrollToBottom('smooth'), 50);

      // 백그라운드 푸시 알림 비동기 발송
      sendPushNotification(trimmed);
    } catch (err: any) {
      console.error('Message send error:', err);
      toast.error('메시지 전송에 실패했습니다. (DB 테이블을 확인해주세요)');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) return null;

  const headerTitle =
    currentRole === 'student'
      ? '📮 이상찬 쌤과의 비밀 톡'
      : '💬 2101 강동헌 학생과의 톡';

  const headerSubtitle =
    currentRole === 'student'
      ? '선생님과 실시간으로 대화할 수 있는 창구입니다.'
      : '실시간 1:1 대화 및 상담';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-md h-[90vh] max-h-[680px] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-amber-200">
        {/* 상단 헤더 */}
        <div className="bg-gradient-to-r from-amber-500 via-orange-400 to-[#FF6F61] p-4 text-white flex items-center justify-between shadow-md select-none shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 text-white text-lg shadow-inner">
              <BsChatDotsFill />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base tracking-tight">{headerTitle}</h3>
                <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-400/90 text-emerald-950 shadow-sm animate-pulse">
                  실시간
                </span>
              </div>
              <p className="text-[11px] text-amber-100 font-medium">{headerSubtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition cursor-pointer"
            title="닫기"
          >
            <IoClose className="w-5 h-5" />
          </button>
        </div>

        {/* 대화 본문 영역 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FFFDF8]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 text-xs gap-2">
              <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
              <span>대화 내용을 불러오는 중...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-10 px-4">
              <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-2xl mb-3 shadow-inner">
                💌
              </div>
              <p className="text-sm font-bold text-gray-700 mb-1">
                아직 나눈 대화가 없습니다.
              </p>
              <p className="text-xs text-gray-500 leading-relaxed">
                {currentRole === 'student'
                  ? '이상찬 선생님께 편지나 첫 인사를 남겨보세요!'
                  : '동헌이에게 먼저 따뜻한 한마디를 건네보세요!'}
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isMine = msg.sender_role === currentRole;
              const timeStr = new Date(msg.created_at).toLocaleTimeString('ko-KR', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              });

              return (
                <div
                  key={msg.id || idx}
                  className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                >
                  {/* 상대방 이름 */}
                  {!isMine && (
                    <span className="text-[11px] font-bold text-gray-600 mb-1 ml-1 flex items-center gap-1">
                      <span>{msg.sender_name}</span>
                      <span className="text-[10px] text-amber-600 font-normal">
                        ({msg.sender_role === 'student' ? '학생' : '선생님'})
                      </span>
                    </span>
                  )}

                  <div
                    className={`flex items-end gap-1.5 max-w-[82%] ${
                      isMine ? 'flex-row-reverse' : 'flex-row'
                    }`}
                  >
                    {/* 말풍선 */}
                    <div
                      className={`px-3.5 py-2.5 rounded-2xl text-xs md:text-sm font-medium leading-relaxed whitespace-pre-wrap break-words shadow-sm ${
                        isMine
                          ? 'bg-gradient-to-tr from-[#FF7A59] to-[#FF6F61] text-white rounded-br-xs'
                          : 'bg-white text-gray-800 border border-amber-200/80 rounded-bl-xs'
                      }`}
                    >
                      {msg.message}
                    </div>

                    {/* 시간 및 읽음 표시 */}
                    <div className="flex flex-col items-end shrink-0 text-[10px] text-gray-400 select-none pb-0.5">
                      {isMine && !msg.is_read && (
                        <span className="text-amber-500 font-extrabold text-[10px] leading-none mb-0.5">
                          1
                        </span>
                      )}
                      <span className="text-[9px] leading-tight text-gray-400">{timeStr}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 메시지 입력창 하단 바 */}
        <form
          onSubmit={handleSendMessage}
          className="p-3 bg-white border-t border-amber-100 flex items-end gap-2 shrink-0"
        >
          <div className="flex-1 bg-amber-50/60 rounded-xl border border-amber-200 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-200/50 transition p-1.5 flex items-center">
            <textarea
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                currentRole === 'student'
                  ? '쌤에게 보낼 메시지를 입력하세요... (Enter 전송)'
                  : '동헌이에게 보낼 답장을 입력하세요... (Enter 전송)'
              }
              className="w-full text-xs md:text-sm bg-transparent resize-none border-none outline-none px-2 py-1 text-gray-800 max-h-24 font-normal placeholder-gray-400"
              style={{ minHeight: '26px' }}
            />
          </div>
          <button
            type="submit"
            disabled={!inputText.trim() || isSending}
            className={`w-10 h-10 rounded-xl flex items-center justify-center text-white transition-all shadow-md shrink-0 cursor-pointer ${
              inputText.trim() && !isSending
                ? 'bg-gradient-to-r from-amber-500 to-[#FF6F61] hover:shadow-amber-200 hover:scale-105 active:scale-95'
                : 'bg-gray-300 cursor-not-allowed shadow-none'
            }`}
            title="보내기"
          >
            <IoSend className="w-4 h-4 ml-0.5" />
          </button>
        </form>
      </div>
    </div>
  );
}

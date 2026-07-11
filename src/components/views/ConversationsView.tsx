import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, CheckCircle, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { Conversation, Lead } from '../../context/AppContext';
import { notify } from '../Toaster';

export const ConversationsView: React.FC = () => {
  const { conversations, leads, addMessageToConversation, updateLeadStatus, redditAccount, sendRedditDm } = useApp();
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [typedMessage, setTypedMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  // Resolve a conversation's lead from the live leads array so status/author/platform stay
  // current (falling back to the embedded snapshot if the lead was deleted).
  const leadFor = (conv: Conversation): Lead => leads.find(l => l.id === conv.leadId) || conv.lead;

  const currentConv = conversations.find(c => c.leadId === activeConvId) || conversations[0] || null;
  const lead = currentConv ? leadFor(currentConv) : null;

  // Keep a valid conversation selected as threads are created or archived.
  useEffect(() => {
    if (conversations.length === 0) {
      if (activeConvId !== null) setActiveConvId(null);
    } else if (!conversations.some(c => c.leadId === activeConvId)) {
      setActiveConvId(conversations[0].leadId);
    }
  }, [conversations, activeConvId]);

  // Auto-scroll the thread to the newest message.
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [currentConv?.leadId, currentConv?.messages.length]);

  // When the lead is on Reddit and the user has connected their account, messages are
  // sent as real Reddit DMs from their account; otherwise we fall back to a local thread.
  const isRedditLead = lead?.platform === 'reddit';
  const canSendReal = isRedditLead && !!redditAccount;

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = typedMessage.trim();
    if (!text || !currentConv || !lead || sending) return;
    const leadId = currentConv.leadId;
    setSendError(null);

    if (canSendReal) {
      setSending(true);
      try {
        const to = (lead.handle || lead.author || '').replace(/^\/?(u\/)?/i, '');
        await sendRedditDm(to, 'Following up from your post', text);
        addMessageToConversation(leadId, 'user', text);
        setTypedMessage('');
      } catch (err) {
        setSendError(err instanceof Error ? err.message : 'Could not send via Reddit. The user may not accept DMs.');
      } finally {
        setSending(false);
      }
      return;
    }

    // Local/demo thread (no connected account): record the message and simulate a reply.
    addMessageToConversation(leadId, 'user', text);
    setTypedMessage('');
    setTimeout(() => {
      const replies = [
        "That sounds fair. What are your rates for a typical project like this?",
        "I'd love to schedule a video call. Are you available tomorrow around 3 PM EST?",
        "Do you have a few references or client case studies I could review?",
        "Awesome! Let's get started. How do we kick off onboarding?"
      ];
      const randomReply = replies[Math.floor(Math.random() * replies.length)];
      addMessageToConversation(leadId, 'lead', randomReply);
    }, 4000);
  };

  const handleMarkWon = () => {
    if (!currentConv || !lead) return;
    updateLeadStatus(currentConv.leadId, 'won');
    notify(`${lead.author} marked as won! 🎉`, 'success');
  };

  const handleArchive = () => {
    if (!currentConv) return;
    updateLeadStatus(currentConv.leadId, 'archived');
    setActiveConvId(null);
    notify('Conversation archived.', 'info');
  };

  return (
    <div className="view-container">
      {/* Header */}
      <div className="view-header">
        <div className="view-title">
          <h1>Conversations Inbox</h1>
          <p>Follow up on active pitches and manage your sales pipeline.</p>
        </div>
      </div>

      <div style={styles.messengerContainer} className="glass-card">
        {/* Left Side: Conversational Leads list */}
        <div style={styles.conversationsSidebar}>
          {conversations.length === 0 ? (
            <div style={styles.emptySidebar}>
              <MessageSquare size={32} color="hsl(var(--text-faint))" style={{ marginBottom: '10px' }} />
              <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))' }}>No active conversations.</p>
              <p style={{ fontSize: '0.75rem', color: 'hsl(var(--text-faint))', textAlign: 'center' }}>Go to Leads and write an AI Pitch to get started.</p>
            </div>
          ) : (
            conversations.map((conv) => {
              const lastMessage = conv.messages[conv.messages.length - 1];
              const isSelected = currentConv?.leadId === conv.leadId;
              const cLead = leadFor(conv);
              return (
                <div
                  key={conv.leadId}
                  onClick={() => setActiveConvId(conv.leadId)}
                  style={{
                    ...styles.convItem,
                    backgroundColor: isSelected ? 'hsl(var(--surface-1))' : 'transparent',
                    borderLeftColor: isSelected ? 'hsl(var(--primary))' : 'transparent'
                  }}
                >
                  <div style={styles.convHeader}>
                    <span style={styles.convAuthor}>{cLead.author}</span>
                    <span style={styles.convTime}>{conv.lastUpdated}</span>
                  </div>
                  <div style={styles.convPlatform}>
                    <span className={`badge badge-${cLead.platform}`} style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                      {cLead.platform}
                    </span>
                    <span className={`badge badge-${cLead.status}`} style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                      {cLead.status}
                    </span>
                  </div>
                  <p style={styles.convSnippet}>
                    {lastMessage ? lastMessage.content.substring(0, 50) + '...' : 'No messages yet.'}
                  </p>
                </div>
              );
            })
          )}
        </div>

        {/* Right Side: Chat Panel */}
        <div style={styles.chatPanel}>
          {currentConv && lead ? (
            <div style={styles.chatLayout}>
              {/* Chat Header */}
              <div style={styles.chatHeader}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ color: 'hsl(var(--text-primary))', fontSize: '1rem', margin: 0 }}>
                      {lead.author}
                    </h3>
                    <span className={`badge badge-${lead.status}`} style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                      {lead.status}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
                    {lead.handle}
                  </span>
                </div>
                <div style={styles.chatActions}>
                  <button 
                    onClick={handleMarkWon} 
                    className="btn-primary" 
                    style={styles.actionBtn}
                  >
                    <CheckCircle size={14} />
                    <span>Won Deal</span>
                  </button>
                  <button 
                    onClick={handleArchive} 
                    className="btn-danger" 
                    style={styles.actionBtn}
                  >
                    <Trash2 size={14} />
                    <span>Archive</span>
                  </button>
                </div>
              </div>

              {/* Chat Thread */}
              <div style={styles.chatThread} ref={threadRef}>
                {currentConv.messages.map((msg) => {
                  const isUser = msg.sender === 'user';
                  return (
                    <div 
                      key={msg.id} 
                      style={{
                        ...styles.msgWrapper,
                        justifyContent: isUser ? 'flex-end' : 'flex-start'
                      }}
                    >
                      <div 
                        style={{
                          ...styles.msgBubble,
                          backgroundColor: isUser ? 'rgba(var(--primary-rgb), 0.1)' : 'hsl(var(--surface-1))',
                          borderColor: isUser ? 'rgba(var(--primary-rgb), 0.2)' : 'hsl(var(--surface-1))',
                          alignItems: isUser ? 'flex-end' : 'flex-start'
                        }}
                      >
                        <p style={styles.msgText}>{msg.content}</p>
                        <span style={styles.msgTime}>{msg.timestamp}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Send mode hint */}
              <div style={{ padding: '0 18px', fontSize: '0.72rem', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '6px', minHeight: 18 }}>
                {sendError
                  ? <span style={{ color: 'hsl(var(--danger))' }}>{sendError}</span>
                  : canSendReal
                    ? <span style={{ color: 'hsl(var(--primary))' }}>● Sending as u/{redditAccount?.username} via Reddit DM</span>
                    : isRedditLead
                      ? <span>Connect your Reddit account in Settings to message this lead for real.</span>
                      : <span>Demo thread — connect an account to send for real.</span>}
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendMessage} style={styles.inputForm}>
                <input
                  type="text"
                  value={typedMessage}
                  onChange={(e) => setTypedMessage(e.target.value)}
                  placeholder={canSendReal ? `Message u/${lead.author} on Reddit...` : 'Type a message to pitch or follow up...'}
                  className="form-input"
                  style={styles.chatInput}
                  disabled={sending}
                />
                <button type="submit" className="btn-primary" style={{ ...styles.sendBtn, opacity: sending ? 0.7 : 1 }} disabled={sending}>
                  <Send size={16} />
                </button>
              </form>
            </div>
          ) : (
            <div style={styles.emptyChat}>
              <MessageSquare size={48} color="hsl(var(--text-faint))" style={{ marginBottom: '15px' }} />
              <h3>Select a Conversation</h3>
              <p>Select a prospect from the sidebar list to view conversation logs.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const styles = {
  messengerContainer: {
    display: 'flex',
    height: '600px',
    borderRadius: '12px',
    overflow: 'hidden' as const
  },
  conversationsSidebar: {
    width: '280px',
    borderRight: '1px solid hsl(var(--surface-1))',
    display: 'flex',
    flexDirection: 'column' as const,
    overflowY: 'auto' as const,
    backgroundColor: 'rgba(0, 0, 0, 0.1)'
  },
  emptySidebar: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '30px 20px',
    flex: 1,
    textAlign: 'center' as const
  },
  convItem: {
    padding: '16px 20px',
    borderBottom: '1px solid hsl(var(--surface-1))',
    borderLeft: '3px solid transparent',
    cursor: 'pointer',
    transition: 'background 0.2s'
  },
  convHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '6px'
  },
  convAuthor: {
    fontWeight: '700',
    fontSize: '0.88rem',
    color: 'hsl(var(--text-primary))'
  },
  convTime: {
    fontSize: '0.75rem',
    color: 'hsl(var(--text-faint))'
  },
  convPlatform: {
    display: 'flex',
    gap: '6px',
    marginBottom: '8px'
  },
  convSnippet: {
    fontSize: '0.8rem',
    color: 'hsl(var(--text-secondary))',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const
  },
  chatPanel: {
    flex: 1,
    backgroundColor: 'hsl(var(--surface-1))'
  },
  chatLayout: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%'
  },
  chatHeader: {
    padding: '20px 25px',
    borderBottom: '1px solid hsl(var(--surface-1))',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  chatActions: {
    display: 'flex',
    gap: '10px'
  },
  actionBtn: {
    padding: '6px 12px',
    fontSize: '0.8rem'
  },
  chatThread: {
    flex: 1,
    padding: '25px',
    overflowY: 'auto' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px'
  },
  msgWrapper: {
    display: 'flex',
    width: '100%'
  },
  msgBubble: {
    padding: '12px 16px',
    borderRadius: '12px',
    border: '1px solid transparent',
    maxWidth: '75%',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px'
  },
  msgText: {
    fontSize: '0.9rem',
    color: 'hsl(var(--text-secondary))',
    lineHeight: '1.5',
    wordBreak: 'break-word' as const
  },
  msgTime: {
    fontSize: '0.7rem',
    color: 'hsl(var(--text-faint))'
  },
  inputForm: {
    padding: '20px 25px',
    borderTop: '1px solid hsl(var(--surface-1))',
    display: 'flex',
    gap: '12px'
  },
  chatInput: {
    flex: 1
  },
  sendBtn: {
    padding: '0 18px'
  },
  emptyChat: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'hsl(var(--text-muted))',
    padding: '20px',
    textAlign: 'center' as const
  }
};
export default ConversationsView;

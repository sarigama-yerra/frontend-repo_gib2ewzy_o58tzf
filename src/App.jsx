import { useEffect, useMemo, useRef, useState } from 'react'
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom'
import { MessageCircle, Plus, Send, Users, Hash, LogOut } from 'lucide-react'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

function useLocalId() {
  const [id, setId] = useState(localStorage.getItem('chat_user_id') || '')
  const [name, setName] = useState(localStorage.getItem('chat_user_name') || '')
  useEffect(() => {
    localStorage.setItem('chat_user_id', id || '')
    localStorage.setItem('chat_user_name', name || '')
  }, [id, name])
  return { id, setId, name, setName }
}

async function api(path, options = {}) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

function AuthGate({ children }) {
  const { id, name, setId, setName } = useLocalId()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')
    const display_name = e.target.display_name.value.trim()
    if (!display_name) return setError('Please enter a display name')
    setLoading(true)
    try {
      const user = await api('/api/users', { method: 'POST', body: JSON.stringify({ display_name }) })
      setId(user.id)
      setName(user.display_name)
    } catch (e) {
      setError('Could not create user')
    } finally { setLoading(false) }
  }

  if (id) return children

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-slate-800/60 border border-slate-700 rounded-xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-indigo-600/20 border border-indigo-500/30">
            <MessageCircle className="w-6 h-6 text-indigo-300" />
          </div>
          <h1 className="text-xl font-semibold">Welcome to Vibe Chat</h1>
        </div>
        <p className="text-slate-300 text-sm mb-4">Pick a display name to start chatting.</p>
        <form onSubmit={handleCreate} className="space-y-3">
          <input name="display_name" placeholder="Display name" className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500" />
          <button disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 rounded-md py-2 font-medium">{loading ? 'Creating...' : 'Enter'}</button>
        </form>
        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
      </div>
    </div>
  )
}

function Sidebar({ rooms, onCreateRoom, activeId, onSelectRoom, onLogout }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  return (
    <div className="w-64 bg-slate-900 text-slate-100 flex flex-col border-r border-slate-800">
      <div className="p-4 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded bg-indigo-600/20 border border-indigo-500/30">
            <Hash className="w-5 h-5 text-indigo-300" />
          </div>
          <span className="font-semibold">Channels</span>
        </div>
        <button onClick={() => setOpen(!open)} className="p-1 hover:bg-slate-800 rounded"><Plus className="w-5 h-5" /></button>
      </div>

      {open && (
        <div className="p-3 border-b border-slate-800">
          <div className="flex gap-2">
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="New channel name" className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1" />
            <button onClick={()=>{ if(!name.trim()) return; onCreateRoom(name.trim()); setName(''); setOpen(false)}} className="bg-indigo-600 px-3 rounded">Add</button>
          </div>
        </div>
      )}

      <div className="overflow-y-auto py-2">
        {rooms.map(r => (
          <button key={r.id} onClick={()=>onSelectRoom(r)} className={`w-full px-4 py-2 flex items-center gap-2 hover:bg-slate-800 ${activeId===r.id? 'bg-slate-800' : ''}`}>
            <Hash className="w-4 h-4 text-slate-400" />
            <span className="truncate">{r.name}</span>
          </button>
        ))}
      </div>

      <div className="mt-auto p-3 border-t border-slate-800">
        <button onClick={onLogout} className="w-full flex items-center gap-2 justify-center bg-slate-800 hover:bg-slate-700 py-2 rounded">
          <LogOut className="w-4 h-4" /> Logout
        </button>
      </div>
    </div>
  )
}

function MessageBubble({ msg, isOwn }) {
  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[70%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap ${isOwn ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-800 text-slate-100 rounded-bl-none'}`}>
        <div className="opacity-80 text-xs mb-1">{msg.sender_id.slice(-4)}</div>
        {msg.content}
      </div>
    </div>
  )
}

function ChatView({ user, room }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const listRef = useRef(null)

  const fetchMessages = async () => {
    try {
      const data = await api(`/api/rooms/${room.id}/messages?limit=100`)
      setMessages(data)
    } catch (e) {
      // ignore
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchMessages() }, [room.id])
  useEffect(() => { listRef.current?.scrollTo(0, listRef.current.scrollHeight) }, [messages])

  const send = async () => {
    const text = input.trim()
    if (!text) return
    setInput('')
    const optimistic = { id: `tmp-${Date.now()}`, sender_id: user.id, content: text }
    setMessages(m => [...m, optimistic])
    try {
      const saved = await api(`/api/rooms/${room.id}/messages`, { method: 'POST', body: JSON.stringify({ sender_id: user.id, content: text }) })
      setMessages(m => m.map(x => x.id===optimistic.id ? saved : x))
    } catch (e) {
      // rollback
      setMessages(m => m.filter(x => x.id!==optimistic.id))
      setInput(text)
      alert('Failed to send')
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="h-14 border-b border-slate-800 flex items-center px-4 gap-2 bg-slate-900/60">
        <Hash className="w-5 h-5 text-slate-400" />
        <div className="font-medium">{room.name}</div>
      </div>
      <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-950">
        {loading ? (
          <div className="text-slate-400">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="text-slate-500">No messages yet. Say hello!</div>
        ) : (
          messages.map(m => (
            <MessageBubble key={m.id} msg={m} isOwn={m.sender_id===user.id} />
          ))
        )}
      </div>
      <div className="h-16 border-t border-slate-800 flex items-center gap-2 px-3 bg-slate-900">
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') send() }} placeholder={`Message #${room.name}`} className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-100 placeholder-slate-400" />
        <button onClick={send} className="bg-indigo-600 hover:bg-indigo-500 rounded px-4 py-2 flex items-center gap-2"><Send className="w-4 h-4" /> Send</button>
      </div>
    </div>
  )
}

function Shell() {
  const { id, name, setId, setName } = useLocalId()
  const [rooms, setRooms] = useState([])
  const [active, setActive] = useState(null)
  const user = useMemo(()=>({ id, display_name: name }), [id, name])

  const loadRooms = async () => {
    const data = await api('/api/rooms')
    setRooms(data)
    if (!active && data[0]) setActive(data[0])
  }

  const createRoom = async (roomName) => {
    const room = await api('/api/rooms', { method: 'POST', body: JSON.stringify({ name: roomName }) })
    setRooms(r => [...r, room])
    setActive(room)
  }

  const logout = () => {
    setId(''); setName('')
  }

  useEffect(() => { loadRooms() }, [])

  if (!id) return null

  return (
    <div className="min-h-screen bg-slate-950 text-white flex">
      <Sidebar rooms={rooms} onCreateRoom={createRoom} activeId={active?.id} onSelectRoom={setActive} onLogout={logout} />
      {active ? <ChatView user={user} room={active} /> : (
        <div className="flex-1 grid place-items-center text-slate-400">Pick or create a channel</div>
      )}
    </div>
  )
}

function App() {
  return (
    <AuthGate>
      <Shell />
    </AuthGate>
  )
}

export default App

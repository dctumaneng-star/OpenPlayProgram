import { useState, useEffect } from 'react';
import axios from 'axios';
import './index.css'

const API_URL = 'http://localhost:5000/api';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [username, setUsername] = useState(localStorage.getItem('username') || '');
  const [records, setRecords] = useState([]);
  
  // Auth Form State
  const [isLogin, setIsLogin] = useState(true);
  const [authForm, setAuthForm] = useState({ email: '', username: '', password: '' });

  // Entry Form State
  const [entryForm, setEntryForm] = useState({
    court_name: '', returning_players: 0, new_players: 0,
    court_fee_rev: 0, misc_rev: 0, base_cost: 0, losses: 0
  });

  useEffect(() => {
    if (token) fetchRecords();
  }, [token]);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isLogin) {
        const res = await axios.post(`${API_URL}/login`, { username: authForm.username, password: authForm.password });
        setToken(res.data.token);
        setUsername(res.data.username);
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('username', res.data.username);
      } else {
        await axios.post(`${API_URL}/signup`, authForm);
        alert('Signup successful! Please login.');
        setIsLogin(true);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Authentication failed');
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUsername('');
    localStorage.removeItem('token');
    localStorage.removeItem('username');
  };

  const fetchRecords = async () => {
    const res = await axios.get(`${API_URL}/open-plays`, { headers: { Authorization: `Bearer ${token}` } });
    setRecords(res.data);
  };

  const handleEntrySubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/open-plays`, entryForm, { headers: { Authorization: `Bearer ${token}` } });
      alert('Record added!');
      fetchRecords(); 
    } catch (err) {
      alert('Error adding record');
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API_URL}/open-plays/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      fetchRecords();
    } catch (err) {
      alert('Error deleting record');
    }
  };

  // --- Auth View ---
  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">🏸 Open Play Finance Tracker</h2>
          
          <div className="flex border-b border-gray-200 mb-6">
            <button 
              className={`flex-1 py-2 font-medium ${isLogin ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setIsLogin(true)}>
              🔑 Login
            </button>
            <button 
              className={`flex-1 py-2 font-medium ${!isLogin ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setIsLogin(false)}>
              📝 Sign Up
            </button>
          </div>

          <form onSubmit={handleAuthSubmit} className="flex flex-col gap-4">
            {!isLogin && (
              <input type="email" placeholder="Email Address" required
                className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                onChange={e => setAuthForm({...authForm, email: e.target.value})} />
            )}
            <input type="text" placeholder="Username" required
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              onChange={e => setAuthForm({...authForm, username: e.target.value})} />
            <input type="password" placeholder="Password" required
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              onChange={e => setAuthForm({...authForm, password: e.target.value})} />
            
            <button type="submit" className="w-full bg-red-400 hover:bg-red-500 text-white font-medium py-2 px-4 rounded transition-colors mt-2">
              {isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- Dashboard View ---
  return (
    <div className="flex h-screen bg-white text-gray-800 font-sans">
      
      {/* Sidebar - Mimics Streamlit's gray sidebar */}
      <div className="w-80 bg-[#f0f2f6] h-full overflow-y-auto p-6 flex flex-col">
        <h3 className="font-semibold text-lg mb-4 text-gray-800">📝 Input New Open Play</h3>
        
        <form onSubmit={handleEntrySubmit} className="flex flex-col gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Court Name</label>
            <input type="text" placeholder="e.g., Court A" required
              className="w-full px-3 py-2 border border-gray-300 rounded shadow-sm focus:outline-none focus:border-blue-500 text-sm"
              onChange={e => setEntryForm({...entryForm, court_name: e.target.value})} />
          </div>
          
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Returning</label>
              <input type="number" value={entryForm.returning_players} min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded shadow-sm text-sm"
                onChange={e => setEntryForm({...entryForm, returning_players: parseInt(e.target.value)})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Newcomers</label>
              <input type="number" value={entryForm.new_players} min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded shadow-sm text-sm"
                onChange={e => setEntryForm({...entryForm, new_players: parseInt(e.target.value)})} />
            </div>
          </div>
          
          <div className="mt-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Court Fee Rev (₱)</label>
            <input type="number" value={entryForm.court_fee_rev} min="0" step="50"
              className="w-full px-3 py-2 border border-gray-300 rounded shadow-sm text-sm"
              onChange={e => setEntryForm({...entryForm, court_fee_rev: parseFloat(e.target.value)})} />
          </div>
          
          <button type="submit" className="mt-4 w-full bg-white border border-gray-300 hover:border-red-400 hover:text-red-400 text-gray-700 font-medium py-2 px-4 rounded shadow-sm transition-colors">
            Add Record to Database
          </button>
        </form>

        <div className="mt-auto pt-8">
          <button onClick={handleLogout} className="w-full py-2 text-sm text-gray-500 hover:text-gray-800 transition-colors">
            Logout
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 h-full overflow-y-auto p-10 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-900">🏸 Open Play Finance Tracker — {username}</h1>
        
        <h2 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">📊 Financial & Player Report</h2>
        
        {records.length === 0 ? (
          <div className="bg-blue-50 text-blue-800 p-4 rounded-md border border-blue-200">
            👈 No data available yet. Please use the sidebar to input open play data.
          </div>
        ) : (
          <div className="overflow-x-auto shadow-sm rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-gray-500 font-medium">
                <tr>
                  <th className="px-6 py-3 text-left tracking-wider">Record ID</th>
                  <th className="px-6 py-3 text-left tracking-wider">Court Name</th>
                  <th className="px-6 py-3 text-left tracking-wider">Total Players</th>
                  <th className="px-6 py-3 text-left tracking-wider">Net Rev (₱)</th>
                  <th className="px-6 py-3 text-right tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {records.map(r => {
                  const totalPlayers = r.returning_players + r.new_players;
                  const netRevenue = (r.court_fee_rev + r.misc_rev) - (r.base_cost + r.losses);
                  return (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">{r.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{r.court_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">{totalPlayers}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-900">₱{netRevenue.toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button 
                          onClick={() => handleDelete(r.id)}
                          className="text-red-500 hover:text-red-700 font-medium px-3 py-1 border border-transparent hover:border-red-200 rounded transition-colors">
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
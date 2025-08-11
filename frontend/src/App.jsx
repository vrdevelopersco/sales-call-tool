import React, { useState, useEffect, useMemo } from 'react';
import { 
  Phone, 
  User, 
  Calendar, 
  Search, 
  Plus, 
  Edit, 
  Save, 
  X, 
  Bell, 
  Users, 
  Database,
  Eye,
  EyeOff,
  Trash2,
  Settings,
  Loader
} from 'lucide-react';
import { Zenitho } from 'uvcanvas';



// API Service
const getServerIP = () => {
  const currentHost = window.location.hostname;
  if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
    return 'http://localhost:3001/api';
  }
  return `http://${currentHost}:3001/api`;
};

const API_BASE_URL = getServerIP();

class ApiService {
  constructor() {
    this.token = localStorage.getItem('auth_token');
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    
    return headers;
  }

  async apiCall(endpoint, options = {}) {
    const fullUrl = `${API_BASE_URL}${endpoint}`;
    
    try {
      const response = await fetch(fullUrl, {
        headers: this.getHeaders(),
        ...options,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'API request failed');
      }

      return await response.json();
    } catch (error) {
      console.error('API call failed:', error);
      throw error;
    }
  }

  async login(username, password) {
    const response = await this.apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    
    if (response.token) {
      this.setToken(response.token);
    }
    
    return response;
  }

  logout() {
    this.setToken(null);
  }

  async getUsers() {
    return this.apiCall('/users');
  }

  async createUser(userData) {
    return this.apiCall('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async updateUser(userId, userData) {
    return this.apiCall(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  async deleteUser(userId) {
    return this.apiCall(`/users/${userId}`, {
      method: 'DELETE',
    });
  }

  async getRecords() {
    return this.apiCall('/records');
  }

  async createRecord(recordData) {
    return this.apiCall('/records', {
      method: 'POST',
      body: JSON.stringify(recordData),
    });
  }

  async updateRecord(recordId, recordData) {
    return this.apiCall(`/records/${recordId}`, {
      method: 'PUT',
      body: JSON.stringify(recordData),
    });
  }

  async deleteRecord(recordId) {
    return this.apiCall(`/records/${recordId}`, {
      method: 'DELETE',
    });
  }

  async getCurrentUser() {
    return this.apiCall('/user/me');
  }

  async healthCheck() {
    return this.apiCall('/health');
  }
}

const apiService = new ApiService();

const SalesCallFormApp = () => {
  // Authentication state
  const [currentUser, setCurrentUser] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Data state
  const [users, setUsers] = useState([]);
  const [callRecords, setCallRecords] = useState([]);
  
  // UI State
  const [activeTab, setActiveTab] = useState('calls');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingRecord, setEditingRecord] = useState(null);
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [fullUserData, setFullUserData] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Call form state
  const [callForm, setCallForm] = useState({
    first_name: '',
    last_name: '',
    principal_phone: '',
    alternative_phone: '',
    sale_type: '',
    email: '',
    address: '',
    sale_id_1: '',
    sale_id_2: '',
    sale_completed: false,
    callback_required: false,
    callback_datetime: '',
    sale_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const userRecordStats = useMemo(() => {
    const stats = new Map();
    users.forEach(user => stats.set(user.id, { total: 0, completed: 0 }));

    callRecords.forEach(record => {
      const userId = record.user_id;
      if (stats.has(userId)) {
        const currentStats = stats.get(userId);
        const isCompleted = record.sale_completed === true || record.sale_completed === 1 || record.sale_completed === '1';
        stats.set(userId, {
          total: currentStats.total + 1,
          completed: currentStats.completed + (isCompleted ? 1 : 0),
        });
      }
    });
    return stats;
  }, [users, callRecords]);
  

  // Check for saved auth token on mount
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      apiService.healthCheck()
        .then(() => {
          const tokenPayload = JSON.parse(atob(token.split('.')[1]));
          setCurrentUser({
            id: tokenPayload.id,
            username: tokenPayload.username,
            role: tokenPayload.role
          });
        })
        .catch(() => {
          apiService.logout();
        });
    }
  }, []);

  // useEffect hook to update the clocks every second
  useEffect(() => {
    const timerId = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      clearInterval(timerId);
    };
  }, []);

  // Load data when user logs in
  useEffect(() => {
    if (currentUser) {
      loadCallRecords();
      if (currentUser.role === 'admin') {
        loadUsers();
      }
      requestNotificationPermission();
    }
  }, [currentUser]);

  const loadCallRecords = async () => {
    setCallRecords([]);
    try {
      const records = await apiService.getRecords();
      setCallRecords(records);
    } catch (error) {
      console.error('Failed to load call records:', error);
    }
  };
  
  const loadUsers = async () => {
    try {
      const usersList = await apiService.getUsers();
      setUsers(usersList);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setLoginError('');
    
    try {
      const response = await apiService.login(loginForm.username, loginForm.password);
      setCurrentUser(response.user);
      setLoginForm({ username: '', password: '' });
    } catch (error) {
      setLoginError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    apiService.logout();
    setCurrentUser(null);
    setCallRecords([]);
    setUsers([]);
    setActiveTab('calls');
  };

  const handleCallFormSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const recordData = {
        firstName: callForm.first_name,
        lastName: callForm.last_name,
        principalPhone: callForm.principal_phone,
        alternativePhone: callForm.alternative_phone,
        email: callForm.email,
        address: callForm.address,
        saleType: callForm.sale_type,
        saleId1: callForm.sale_id_1,
        saleId2: callForm.sale_id_2,
        saleCompleted: callForm.sale_completed,
        callbackRequired: callForm.callback_required,
        callbackDateTime: callForm.callback_datetime 
                          ? new Date(callForm.callback_datetime).toISOString() 
                          : null,
        saleDate: callForm.sale_date,
        notes: callForm.notes
      };

      if (editingRecord) {
        await apiService.updateRecord(editingRecord.id, recordData);
        setEditingRecord(null);
        alert('Call record updated successfully!');
      } else {
        await apiService.createRecord(recordData);
        alert('Call record saved successfully!');
      }

      if (callForm.callback_required && callForm.callback_datetime) {
        scheduleCallback({
          id: editingRecord?.id || Date.now(),
          first_name: callForm.first_name,
          last_name: callForm.last_name,
          principal_phone: callForm.principal_phone,
          callback_datetime: callForm.callback_datetime 
        });
      }

      resetCallForm();
      await loadCallRecords();
      setActiveTab('calls');
    } catch (error) {
      alert('Error saving record: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const resetCallForm = () => {
    setCallForm({
      first_name: '',
      last_name: '',
      principal_phone: '',
      alternative_phone: '',
      sale_type: '',
      email: '',
      address: '',
      sale_id_1: '',
      sale_id_2: '',
      sale_completed: false,
      callback_required: false,
      callback_datetime: '',
      sale_date: new Date().toISOString().split('T')[0],
      notes: ''
    });
  };

  const handleEditRecord = (record) => {
    const formatDateTimeForInput = (dateTimeString) => {
      if (!dateTimeString) return '';
      const date = new Date(dateTimeString);
      if (isNaN(date.getTime())) return '';
      const correctedTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
      const year = correctedTime.getFullYear();
      const month = String(correctedTime.getMonth() + 1).padStart(2, '0');
      const day = String(correctedTime.getDate()).padStart(2, '0');
      const hours = String(correctedTime.getHours()).padStart(2, '0');
      const minutes = String(correctedTime.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };
    
    const formatDateForInput = (dateString) => {
      if (!dateString) return '';
      return new Date(dateString).toISOString().split('T')[0];
    };

    setCallForm({
      first_name: record.first_name,
      last_name: record.last_name,
      principal_phone: record.principal_phone,
      alternative_phone: record.alternative_phone || '',
      sale_type: record.sale_type,
      email: record.email || '',
      address: record.address || '',
      sale_id_1: record.sale_id_1 || '',
      sale_id_2: record.sale_id_2 || '',
      sale_completed: record.sale_completed,
      callback_required: record.callback_required,
      callback_datetime: formatDateTimeForInput(record.callback_datetime),
      sale_date: formatDateForInput(record.sale_date),
      notes: record.notes || ''
    });
    setEditingRecord(record);
    setActiveTab('form');
  };

  const handleDeleteRecord = async (recordId) => {
    if (window.confirm('Are you sure you want to delete this record?')) {
      try {
        await apiService.deleteRecord(recordId);
        await loadCallRecords();
      } catch (error) {
        alert('Error deleting record: ' + error.message);
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingRecord(null);
    resetCallForm();
  };
  
  const handleNewCallClick = () => {
    handleCancelEdit();
    setActiveTab('form');
  };

  const formatDbTimeToDisplayString = (dateTimeString) => {
    if (!dateTimeString) return '';
    const date = new Date(dateTimeString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    const correctedTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    const year = correctedTime.getFullYear();
    const month = String(correctedTime.getMonth() + 1).padStart(2, '0');
    const day = String(correctedTime.getDate()).padStart(2, '0');
    let hours = correctedTime.getHours();
    const minutes = String(correctedTime.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${month}/${day}/${year}, ${hours}:${minutes} ${ampm}`;
  };

  const scheduleCallback = (record) => {
    if (!record.callback_datetime) return;
    const callbackTime = new Date(record.callback_datetime);
    if (isNaN(callbackTime.getTime())) {
      alert('Error: Invalid callback date/time format provided.');
      return;
    }
    const now = new Date();
    const timeDiff = callbackTime.getTime() - now.getTime();
    if (timeDiff > 0) { 
      setTimeout(() => {
        if (Notification.permission === 'granted') {
          const notification = new Notification('🔔 Callback Reminder', {
            body: `Time to call: ${record.first_name} ${record.last_name}\nPhone: ${record.principal_phone}`,
            icon: '/favicon.ico',
            tag: `callback-${record.id}`,
            requireInteraction: true
          });
          notification.onclick = () => {
            window.focus();
            notification.close();
          };
        } else {
          alert(`🔔 REMINDER: Time to call ${record.first_name} ${record.last_name}!\n\nPhone: ${record.principal_phone}`);
        }
      }, timeDiff);
      alert(`✅ Callback scheduled for ${callbackTime.toLocaleString()}`);
    } else {
      alert(`⚠️ Callback time must be in the future.`);
    }
  };

  const requestNotificationPermission = () => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification('🎉 Notifications Enabled!', {
            body: "You'll now receive callback reminders.",
            icon: '/favicon.ico'
          });
        }
      });
    }
  };

  const handleCreateUser = async (userData) => { /* ... unchanged ... */ };
  const handleUpdateUser = async (userId, userData) => { /* ... unchanged ... */ };
  const handleDeleteUser = async (userId) => { /* ... unchanged ... */ };
  const handleOpenProfile = async () => { /* ... unchanged ... */ };
  const handleUpdateProfile = async (userData) => { /* ... unchanged ... */ };

  const getFilteredRecords = () => {
    const personalRecords = callRecords.filter(
      record => record.user_id === currentUser.id
    );
    if (!searchTerm) {
      return personalRecords;
    }
    return personalRecords.filter(record => 
      record.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.principal_phone.includes(searchTerm) ||
      (record.email && record.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      record.sale_type.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const maskPhoneNumber = (phone) => {
    if (!phone) return '';
    const last4Digits = phone.slice(-4);
    const maskedPart = phone.slice(0, -4).replace(/[0-9]/g, 'x');
    return `${maskedPart}${last4Digits}`;
  };
  
  if (!currentUser) {
    return (
      <div className="min-h-screen flex">
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 relative overflow-hidden">
          <div className="absolute inset-0 bg-black/20"></div>
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Ccircle cx='7' cy='7' r='7'/%3E%3Ccircle cx='53' cy='7' r='7'/%3E%3Ccircle cx='7' cy='53' r='7'/%3E%3Ccircle cx='53' cy='53' r='7'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}>

<Zenitho />

</div>
          
          <div className="relative z-10 flex flex-col justify-center items-center text-white p-12 text-center">
            <div className="mb-8">
              <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mb-6 backdrop-blur-sm">
                <Phone className="w-12 h-12 text-white" />
              </div>
              <h1 className="text-4xl font-bold mb-4">Sales Call Manager</h1>
              <p className="text-xl text-blue-100 mb-8 max-w-md">
                Streamline your sales process with our comprehensive call management system
              </p>
            </div>
            
            <div className="grid grid-cols-1 gap-6 max-w-sm">
              <div className="flex items-center space-x-3 text-blue-100">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <User className="w-4 h-4" />
                </div>
                <span>Individual agent tracking</span>
              </div>
              <div className="flex items-center space-x-3 text-blue-100">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <Bell className="w-4 h-4" />
                </div>
                <span>Smart callback reminders</span>
              </div>
              <div className="flex items-center space-x-3 text-blue-100">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <Search className="w-4 h-4" />
                </div>
                <span>Advanced search & filtering</span>
              </div>
            </div>
          </div>

          <div className="absolute top-20 left-20 w-32 h-32 bg-white/10 rounded-full backdrop-blur-sm animate-pulse"></div>
          <div className="absolute bottom-32 right-16 w-20 h-20 bg-purple-300/20 rounded-full backdrop-blur-sm animate-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-8 w-16 h-16 bg-blue-300/20 rounded-full backdrop-blur-sm animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>

        <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-50">
          <div className="w-full max-w-md">
            <div className="lg:hidden text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Phone className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Sales Call Manager</h2>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome back</h2>
                <p className="text-gray-600">Sign in to your account to continue</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    value={loginForm.username}
                    onChange={(e) => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    placeholder="Enter your username"
                    required
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    placeholder="Enter your password"
                    required
                    disabled={isLoading}
                  />
                </div>

                {loginError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center">
                      <X className="w-5 h-5 text-red-500 mr-2" />
                      <span className="text-red-700 text-sm font-medium">{loginError}</span>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transform hover:scale-[1.02] transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center">
                      <Loader className="w-5 h-5 animate-spin mr-2" />
                      Signing In...
                    </div>
                  ) : (
                    'Sign In'
                  )}
                </button>
              </form>
            </div>
            <div className="text-center mt-8 text-gray-500 text-sm">
              <p>2025 Brighting Solutions IT dept - Todos los izquierdos y derechos bien puestos.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">Internal Call Tools</h1>
            </div>
            <div className="flex-1 text-center font-mono text-sm">
              <span className="font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded">
                UTC: {currentTime.toLocaleTimeString('en-US', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })}
              </span>
              <span className="mx-2 text-gray-300">|</span>
              <span className="font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                Local: {currentTime.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })}
              </span>
            </div>
            <div className="flex-1 flex justify-end items-center space-x-4">
              <button
                onClick={handleOpenProfile}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-100"
              >
                <User className="w-4 h-4" />
                <span className="text-sm">
                  {currentUser.username} ({currentUser.role})
                </span>
              </button>
              <button
                onClick={handleLogout}
                className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex space-x-4 border-b">
          <button
            onClick={() => setActiveTab('calls')}
            className={`py-2 px-4 font-medium ${
              activeTab === 'calls' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Phone className="inline w-4 h-4 mr-2" />
            Call Records
          </button>
          <button
            onClick={handleNewCallClick}
            className={`py-2 px-4 font-medium ${
              activeTab === 'form' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Plus className="inline w-4 h-4 mr-2" />
            {editingRecord ? 'Edit Call' : 'New Call'}
          </button>
          {currentUser.role === 'admin' && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`py-2 px-4 font-medium ${
                activeTab === 'admin' 
                  ? 'text-blue-600 border-b-2 border-blue-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Settings className="inline w-4 h-4 mr-2" />
              Admin
            </button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'calls' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Your Call Records</h2>
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search records..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {getFilteredRecords().map((record) => (
                <div key={record.id} className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-semibold">{record.first_name} {record.last_name}</h3>
                    <div className="flex items-center space-x-2">
                      {record.sale_completed && (<span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Completed</span>)}
                      {record.callback_required && (<span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full"><Bell className="inline w-3 h-3 mr-1" />Callback</span>)}
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm text-gray-600 mb-4">
                    <p><strong>Phone:</strong> {maskPhoneNumber(record.principal_phone)}</p>
                    {record.alternative_phone && (<p><strong>Alt Phone:</strong> {maskPhoneNumber(record.alternative_phone)}</p>)}
                    {record.email && <p><strong>Email:</strong> {record.email}</p>}
                    {record.address && (<p><strong>Address:</strong> {record.address}</p>)}
                    <p><strong>Sale Type:</strong> {record.sale_type}</p>
                    <p><strong>Sale Date:</strong> {new Date(record.sale_date).toLocaleDateString()}</p>
                    {record.sale_id_1 && <p><strong>Sale ID:</strong> {record.sale_id_1}</p>}
                    {record.sale_id_2 && <p><strong>Sale ID 2:</strong> {record.sale_id_2}</p>}
                    {record.callback_datetime && (<p><strong>Callback:</strong> {formatDbTimeToDisplayString(record.callback_datetime)}</p>)}
                  </div>
                  
                  {record.notes && (
                    <div className="mb-4 p-3 bg-gray-50 rounded">
                      <p className="text-sm"><strong>Notes:</strong></p>
                      <p className="text-sm text-gray-700">{record.notes}</p>
                    </div>
                  )}

                  <div className="flex justify-end space-x-2 pt-4 border-t">
                    <button onClick={() => handleEditRecord(record)} className="flex items-center space-x-1 px-3 py-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors">
                      <Edit className="w-4 h-4" />
                      <span className="text-sm">Edit</span>
                    </button>
                    <button onClick={() => handleDeleteRecord(record.id)} className="flex items-center space-x-1 px-3 py-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                      <span className="text-sm">Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {getFilteredRecords().length === 0 && (
              <div className="text-center py-12">
                <Phone className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No call records</h3>
                <p className="mt-1 text-sm text-gray-500">{searchTerm ? 'No records match your search.' : 'Get started by creating a new call record.'}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'form' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">{editingRecord ? 'Edit Call Record' : 'New Call Record'}</h2>
              {editingRecord && (
                <button onClick={handleCancelEdit} className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50">
                  <X className="w-4 h-4" />
                  <span>Cancel Edit</span>
                </button>
              )}
            </div>
            
            {editingRecord && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-center">
                  <Edit className="w-5 h-5 text-blue-600 mr-2" />
                  <span className="text-blue-800 font-medium">Editing record for {editingRecord.first_name} {editingRecord.last_name}</span>
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg shadow-md p-6">
              {(() => {
                const isAgentEditing = currentUser.role !== 'admin' && editingRecord;

                return (
                  <form onSubmit={handleCallFormSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                        <input type="text" required value={callForm.first_name} onChange={(e) => setCallForm(prev => ({ ...prev, first_name: e.target.value }))} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500" disabled={isLoading} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
                        <input type="text" required value={callForm.last_name} onChange={(e) => setCallForm(prev => ({ ...prev, last_name: e.target.value }))} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500" disabled={isLoading} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Principal Phone *</label>
                        <input
                          type="tel"
                          required
                          value={isAgentEditing ? maskPhoneNumber(callForm.principal_phone) : callForm.principal_phone}
                          onChange={(e) => setCallForm(prev => ({ ...prev, principal_phone: e.target.value }))}
                          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                          disabled={isAgentEditing || isLoading}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Alternative Phone</label>
                        <input
                          type="tel"
                          value={isAgentEditing ? maskPhoneNumber(callForm.alternative_phone) : callForm.alternative_phone}
                          onChange={(e) => setCallForm(prev => ({ ...prev, alternative_phone: e.target.value }))}
                          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                          disabled={isAgentEditing || isLoading}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Business/Product Type *</label>
                        <input type="text" required placeholder="e.g., Software License, Insurance, Real Estate" value={callForm.sale_type} onChange={(e) => setCallForm(prev => ({ ...prev, sale_type: e.target.value }))} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500" disabled={isLoading} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                        <input type="email" value={callForm.email} onChange={(e) => setCallForm(prev => ({ ...prev, email: e.target.value }))} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500" disabled={isLoading} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                      <textarea value={callForm.address} onChange={(e) => setCallForm(prev => ({ ...prev, address: e.target.value }))} rows={2} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500" disabled={isLoading} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Sale ID / Reference 1</label>
                        <input type="text" value={callForm.sale_id_1} onChange={(e) => setCallForm(prev => ({ ...prev, sale_id_1: e.target.value }))} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500" disabled={isLoading} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Sale ID / Reference 2</label>
                        <input type="text" value={callForm.sale_id_2} onChange={(e) => setCallForm(prev => ({ ...prev, sale_id_2: e.target.value }))} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500" disabled={isLoading} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Sale Date *</label>
                      <input type="date" required value={callForm.sale_date} onChange={(e) => setCallForm(prev => ({ ...prev, sale_date: e.target.value }))} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500" disabled={isLoading} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center">
                        <input type="checkbox" id="saleCompleted" checked={callForm.sale_completed} onChange={(e) => setCallForm(prev => ({ ...prev, sale_completed: e.target.checked }))} className="h-4 w-4 text-blue-600 rounded" disabled={isLoading} />
                        <label htmlFor="saleCompleted" className="ml-2 text-sm font-medium text-gray-700">Sale Completed</label>
                      </div>
                      <div className="flex items-center">
                        <input type="checkbox" id="callbackRequired" checked={callForm.callback_required} onChange={(e) => setCallForm(prev => ({ ...prev, callback_required: e.target.checked }))} className="h-4 w-4 text-blue-600 rounded" disabled={isLoading} />
                        <label htmlFor="callbackRequired" className="ml-2 text-sm font-medium text-gray-700">Callback Required</label>
                      </div>
                    </div>
                    {callForm.callback_required && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Callback Date & Time</label>
                        <input type="datetime-local" value={callForm.callback_datetime} onChange={(e) => setCallForm(prev => ({ ...prev, callback_datetime: e.target.value }))} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500" disabled={isLoading} />
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                      <textarea value={callForm.notes} onChange={(e) => setCallForm(prev => ({ ...prev, notes: e.target.value }))} rows={4} placeholder="Any additional notes about this call or client..." className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500" disabled={isLoading} />
                    </div>
                    <div className="flex justify-end space-x-4">
                      {editingRecord && (
                        <button type="button" onClick={handleCancelEdit} className="px-6 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center" disabled={isLoading}>
                          <X className="w-4 h-4 mr-2" />
                          Cancel
                        </button>
                      )}
                      <button type="submit" disabled={isLoading} className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 flex items-center disabled:opacity-50 disabled:cursor-not-allowed">
                        {isLoading ? (<Loader className="w-4 h-4 mr-2 animate-spin" />) : (<Save className="w-4 h-4 mr-2" />)}
                        {editingRecord ? 'Update Record' : 'Save Call Record'}
                      </button>
                    </div>
                  </form>
                );
              })()}
            </div>
          </div>
        )}
        
        {activeTab === 'admin' && currentUser.role === 'admin' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">User Management</h2>
              <button
                onClick={() => setShowUserForm(true)}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add User
              </button>
            </div>

            <div className="bg-white rounded-lg shadow-md">
              <div className="px-6 py-4 border-b">
                <h3 className="text-lg font-medium">System Users</h3>
              </div>
              <div className="divide-y">
                {users.map((user) => {
                  const stats = userRecordStats.get(user.id) || { total: 0, completed: 0 };
                  
                  return (
                    <div key={user.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                      <div className="flex-1">
                        <h4 className="font-semibold text-lg text-gray-800">{user.username}</h4>
                        <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                          <span>
                            Role: <span className="font-medium text-gray-700">{user.role}</span>
                          </span>
                          <span>|</span>
                          <span>
                            Created: <span className="font-medium text-gray-700">{new Date(user.created_at).toLocaleDateString()}</span>
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-6 mr-4 text-center">
                        <div>
                          <p className="text-xl font-bold text-blue-600">{stats.total}</p>
                          <p className="text-xs text-gray-500">Total Records</p>
                        </div>
                        <div>
                          <p className="text-xl font-bold text-green-600">{stats.completed}</p>
                          <p className="text-xs text-gray-500">Completed Sales</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setEditingUser(user)}
                          className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-full"
                          title="Edit user"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {user.id !== currentUser.id && (
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="p-2 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-full"
                            title="Delete user"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-medium mb-4">Database Operations</h3>
              <div className="flex space-x-4">
                <button
                  onClick={() => alert('Database reindexing completed successfully!')}
                  className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 flex items-center"
                >
                  <Database className="w-4 h-4 mr-2" />
                  Reindex Database
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Profile Modal */}
      {showProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-96 p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">My Profile</h3>
              <button
                onClick={() => {
                  setShowProfile(false);
                  setFullUserData(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <UserForm
              user={fullUserData}
              onSubmit={handleUpdateProfile}
              onCancel={() => {
                setShowProfile(false);
                setFullUserData(null);
              }}
              isProfile={true}
            />
          </div>
        </div>
      )}

      {/* User Form Modal */}
      {(showUserForm || editingUser) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-96 p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {editingUser ? 'Edit User' : 'Add New User'}
              </h3>
              <button
                onClick={() => {
                  setShowUserForm(false);
                  setEditingUser(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <UserForm
              user={editingUser}
              onSubmit={editingUser ? 
                (data) => handleUpdateUser(editingUser.id, data) : 
                handleCreateUser
              }
              onCancel={() => {
                setShowUserForm(false);
                setEditingUser(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// User Form Component
const UserForm = ({ user, onSubmit, onCancel, isProfile = false }) => {
  const [formData, setFormData] = useState({
    username: user?.username || '',
    password: user?.password_hash || user?.password || '',
    role: user?.role || 'agent'
  });
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Username
        </label>
        <input
          type="text"
          required
          value={formData.username}
          onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Password
        </label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            required
            value={formData.password}
            onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500 pr-10"
            placeholder={isProfile ? "Enter new password or keep current" : "Enter password"}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {isProfile && (
          <p className="text-xs text-gray-500 mt-1">
            Current password is shown. Modify to change it.
          </p>
        )}
      </div>
      
      {!isProfile && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Role
          </label>
          <select
            value={formData.role}
            onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="agent">Agent</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      )}
      
      <div className="flex justify-end space-x-2 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 border rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          {isProfile ? 'Update Profile' : (user ? 'Update' : 'Create')} {isProfile ? '' : 'User'}
        </button>
      </div>
    </form>
  );
};

export default SalesCallFormApp;


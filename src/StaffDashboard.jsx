import { useEffect, useState, useRef } from "react";
import { auth, db } from "./firebase";
import { signOut } from "firebase/auth";
import { collection, query, onSnapshot, doc, updateDoc, addDoc, deleteDoc, getDocs, where, orderBy } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import logoImg from './logo.png'; 

// --- CONSTANTS FOR SELECTIONS ---
const VISIT_REASONS = [
    "Routine Check-up", 
    "Follow-up Check-up", 
    "Vaccination", 
    "Deworming"
];

const SYMPTOM_OPTIONS = [
    "Vomiting", "Diarrhea", "Loss of Appetite", "Coughing", "Sneezing",
    "Limping / Lameness", "Skin Irritation / Itching", "Wound / Injury",
    "Eye Infection / Red Eyes", "Ear Infection / Ear Mites", "Fever", "Weight Loss"
];

const DIAGNOSIS_OPTIONS = [
    "Gastroenteritis", "Upper Respiratory Infection (URI)", "Parvovirus Infection", "Distemper (suspected)",
    "Kennel Cough", "Fever of Unknown Origin", "Dehydration",
    "Dermatitis", "Flea Infestation", "Tick Infestation", "Mange (Demodectic/Sarcoptic)",
    "Allergic Skin Reaction", "Hot Spots", "Ringworm (Fungal Infection)",
    "Ear Infection (Otitis)", "Ear Mites", "Conjunctivitis (Eye Infection)", "Corneal Ulcer",
    "Vomiting (unspecified cause)", "Diarrhea (unspecified cause)", "Intestinal Parasites", "Constipation", "Foreign Body Ingestion (suspected)",
    "Pneumonia", "Bronchitis", "Asthma (cats)", "Difficulty Breathing (Dyspnea)",
    "Urinary Tract Infection (UTI)", "Bladder Stones (suspected)", "Pyometra", "Pregnancy",
    "Sprain / Strain", "Fracture", "Arthritis", "Hip Dysplasia (suspected)",
    "Dental Disease", "Tooth Abscess",
    "Diabetes Mellitus", "Heart Disease", "Kidney Disease", "Liver Disease"
];

// --- TOAST COMPONENT ---
const Toast = ({ message, type, onClose }) => {
    if (!message) return null;
    return (
        <div style={{
            position: "fixed", bottom: "20px", right: "20px", 
            background: type === "error" ? "#f44336" : "#4CAF50",
            color: "white", padding: "15px 25px", borderRadius: "8px", 
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)", zIndex: 3000, 
            display: "flex", alignItems: "center", gap: "10px", animation: "slideIn 0.3s ease-out"
        }}>
            <span>{type === "error" ? "⚠️" : "✅"}</span>
            <span style={{fontWeight: "500"}}>{message}</span>
            <button onClick={onClose} style={{background:"none", border:"none", color:"white", marginLeft:"10px", cursor:"pointer", fontWeight:"bold"}}>✕</button>
        </div>
    );
};

const StaffDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("appointments"); 
  const scrollRef = useRef(); 

  // --- Notification States ---
  const [showNotifications, setShowNotifications] = useState(false);
  const [readNotifIds, setReadNotifIds] = useState([]); 

  // Toast State
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const showToast = (message, type = "success") => {
      setToast({ show: true, message, type });
      setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  };

  // --- CALENDAR STATES ---
  const [apptViewMode, setApptViewMode] = useState("calendar"); 
  const [calendarView, setCalendarView] = useState("month"); 
  const [currentDate, setCurrentDate] = useState(new Date());

  // --- Walk-in Modal States ---
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [walkInData, setWalkInData] = useState({ ownerId: "", petId: "", petName: "", date: "", time: "", reason: "" });

  // Data States
  const [appointments, setAppointments] = useState([]);
  const [owners, setOwners] = useState([]); 
  const [allPets, setAllPets] = useState([]); 
  const [reports, setReports] = useState([]);
  
  const [apptSubTab, setApptSubTab] = useState("Pending");

  // Consultation Form State
  const [showConsultModal, setShowConsultModal] = useState(false);
  const [selectedApptId, setSelectedApptId] = useState(null);

  const [consultData, setConsultData] = useState({ 
      date: "",
      reason: "",
      symptoms: [], 
      diagnosis: "", 
      medicine: "", 
      notes: "",
      followUp: "" 
  });

  // Records / Pet List State
  const [petSearch, setPetSearch] = useState("");
  const [viewingPet, setViewingPet] = useState(null); 

  // Chat States
  const [selectedChatOwner, setSelectedChatOwner] = useState(null); 
  const [chatMessages, setChatMessages] = useState([]); 
  const [chatInput, setChatInput] = useState("");
  const [allMessages, setAllMessages] = useState([]);
  const [editingMessageId, setEditingMessageId] = useState(null);

  // Report States
  const [reportTitle, setReportTitle] = useState("");
  const [reportContent, setReportContent] = useState("");
  const [reportSearch, setReportSearch] = useState(""); 
  const [editingReportId, setEditingReportId] = useState(null);

  // --- DATA FETCHING ---
  useEffect(() => {
    const unsubAppts = onSnapshot(query(collection(db, "appointments"), orderBy("date", "desc")), (snap) => 
        setAppointments(snap.docs.map(doc => ({ ...doc.data(), id: doc.id })))
    );

    const unsubReports = onSnapshot(query(collection(db, "reports"), orderBy("date", "desc")), (snap) => 
        setReports(snap.docs.map(doc => ({ ...doc.data(), id: doc.id })))
    );
    
    const unsubChat = onSnapshot(query(collection(db, "messages"), orderBy("createdAt", "asc")), (snap) => {
        setAllMessages(snap.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });

    const fetchBasicData = async () => {
        const petSnap = await getDocs(collection(db, "pets"));
        setAllPets(petSnap.docs.map(doc => ({ ...doc.data(), id: doc.id })));
        
        const userSnap = await getDocs(query(collection(db, "users"), where("role", "==", "owner")));
        setOwners(userSnap.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    };
    fetchBasicData();

    return () => { unsubAppts(); unsubReports(); unsubChat(); };
  }, []);

  // --- NEW: AUTO-MARK AS READ LOGIC ---
  // When you open a chat with an owner, mark their messages as read
  useEffect(() => {
    if (activeTab === "messages" && selectedChatOwner) {
        // Find unread messages from this owner
        const unreadMsgs = allMessages.filter(
            m => m.senderId === selectedChatOwner.id && !m.read && m.senderId !== "AI_BOT"
        );
        
        // Update them in the database
        if (unreadMsgs.length > 0) {
            unreadMsgs.forEach(async (msg) => {
                try {
                    await updateDoc(doc(db, "messages", msg.id), { read: true });
                } catch (error) {
                    console.error("Error marking read:", error);
                }
            });
        }
    }
  }, [activeTab, selectedChatOwner, allMessages]);

  // --- DATE NORMALIZER ---
  const normalizeDate = (dateInput) => {
      if (!dateInput) return "";
      let d = new Date(dateInput);
      if (!isNaN(d.getTime())) {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
      }
      return "";
  };

  // --- HELPERS ---
  const filteredRecords = allPets.filter(pet => {
      const owner = owners.find(o => o.id === pet.ownerId);
      const ownerName = owner ? `${owner.firstName} ${owner.lastName}`.toLowerCase() : "";
      const searchLower = petSearch.toLowerCase();
      return pet.name.toLowerCase().startsWith(searchLower) || ownerName.startsWith(searchLower);
  }).sort((a, b) => a.name.localeCompare(b.name)); 

  const filteredReports = reports.filter(rep => 
      rep.title.toLowerCase().includes(reportSearch.toLowerCase()) || 
      rep.date.includes(reportSearch)
  );

  const getUnreadCount = (ownerId) => allMessages.filter(m => m.senderId === ownerId && !m.read && m.senderId !== "AI_BOT").length;
  
  // --- NEW: TOTAL UNREAD COUNT FOR MAIN TAB ---
  const totalUnreadMessages = allMessages.filter(m => m.senderId !== auth.currentUser?.uid && !m.read && m.senderId !== "AI_BOT").length;

  // --- ACTIONS ---
  const handleStatusUpdate = async (id, newStatus) => { await updateDoc(doc(db, "appointments", id), { status: newStatus, staffId: auth.currentUser.uid }); };
  
  const openConsultModal = (apptId) => {
      setSelectedApptId(apptId);
      const appt = appointments.find(a => a.id === apptId);
      
      const scheduledDate = normalizeDate(appt.date);
      
      const existingSymptoms = appt.symptoms ? appt.symptoms.split(", ") : [];

      setConsultData({ 
          date: scheduledDate || new Date().toISOString().split('T')[0],
          reason: appt.reason || "",
          symptoms: existingSymptoms, 
          diagnosis: appt.diagnosis || "", 
          medicine: appt.medicine || "", 
          notes: appt.notes || "",
          followUp: "" 
      });
      setShowConsultModal(true);
  };

  const handleFinishConsultation = async (e) => {
      e.preventDefault();
      if (!selectedApptId) return;

      const symptomsString = consultData.symptoms.join(", ");

      await updateDoc(doc(db, "appointments", selectedApptId), {
          status: "Done",
          date: consultData.date,
          reason: consultData.reason,
          symptoms: symptomsString, 
          diagnosis: consultData.diagnosis,
          medicine: consultData.medicine,
          notes: consultData.notes,
          followUpDate: consultData.followUp,
          staffId: auth.currentUser.uid
      });

      if (consultData.followUp) {
          const currentAppt = appointments.find(a => a.id === selectedApptId);
          if (currentAppt) {
              try {
                  await addDoc(collection(db, "appointments"), {
                      ownerId: currentAppt.ownerId,
                      petId: currentAppt.petId,
                      petName: currentAppt.petName,
                      date: consultData.followUp,
                      time: currentAppt.time || "09:00",
                      reason: `Follow-up: ${consultData.diagnosis}`,
                      status: "Approved",
                      type: "follow-up",
                      createdAt: new Date(),
                      staffId: auth.currentUser.uid
                  });
                  showToast("Consultation Completed & Follow-up Scheduled!");
              } catch (error) { console.error(error); }
          }
      } else {
          showToast("Consultation Completed!");
      }
      setShowConsultModal(false);
  };
  
  const handleSymptomChange = (symptom) => {
      setConsultData(prev => {
          const exists = prev.symptoms.includes(symptom);
          if (exists) {
              return { ...prev, symptoms: prev.symptoms.filter(s => s !== symptom) };
          } else {
              return { ...prev, symptoms: [...prev.symptoms, symptom] };
          }
      });
  };

  const handleStartEdit = (msg) => { setEditingMessageId(msg.id); setChatInput(msg.text); };
  const handleCancelEdit = () => { setEditingMessageId(null); setChatInput(""); };

  const handleSendMessage = async (e) => {
      e.preventDefault();
      if(!chatInput.trim() || !selectedChatOwner) return;

      if (editingMessageId) {
          await updateDoc(doc(db, "messages", editingMessageId), { text: chatInput, isEdited: true });
          setEditingMessageId(null);
      } else {
          await addDoc(collection(db, "messages"), { 
              text: chatInput, senderId: auth.currentUser.uid, senderName: "Staff", receiverId: selectedChatOwner.id, createdAt: new Date(), participants: [auth.currentUser.uid, selectedChatOwner.id], type: "chat", read: false 
          });
      }
      setChatInput("");
  };

  const handleSaveReport = async (e) => {
      e.preventDefault();
      if (editingReportId) { await updateDoc(doc(db, "reports", editingReportId), { title: reportTitle, content: reportContent, lastEdited: new Date() }); setEditingReportId(null); } 
      else { await addDoc(collection(db, "reports"), { title: reportTitle, content: reportContent, authorId: auth.currentUser.uid, date: new Date().toISOString().split('T')[0] }); }
      setReportTitle(""); setReportContent(""); 
      showToast("Report Saved Successfully!");
  };

  const handleDeleteReport = async (id) => { if(window.confirm("Delete?")) await deleteDoc(doc(db, "reports", id)); };
  const handleEditClick = (report) => { setEditingReportId(report.id); setReportTitle(report.title); setReportContent(report.content); };
  const handleLogout = async () => { await signOut(auth); navigate("/"); };
  
  const handleCreateWalkIn = async (e) => {
      e.preventDefault();
      const selectedDate = new Date(walkInData.date);
      if (selectedDate.getDay() === 6) return showToast("Cannot book on Saturdays. Clinic is closed.", "error");

      try {
          await addDoc(collection(db, "appointments"), {
              ownerId: walkInData.ownerId,
              petId: walkInData.petId,
              petName: walkInData.petName,
              date: walkInData.date,
              time: walkInData.time,
              reason: walkInData.reason,
              status: "Approved", 
              type: "walk-in",
              createdAt: new Date(),
              staffId: auth.currentUser.uid
          });
          showToast("Walk-in appointment created successfully!");
          setShowWalkInModal(false);
          setWalkInData({ ownerId: "", petId: "", petName: "", date: "", time: "", reason: "" });
      } catch (err) {
          console.error(err);
          showToast("Error creating appointment.", "error");
      }
  };

  // --- CALENDAR LOGIC ---
  const handleDateNavigate = (direction) => {
    const newDate = new Date(currentDate);
    if (calendarView === 'month') newDate.setMonth(newDate.getMonth() + direction);
    else newDate.setDate(newDate.getDate() + (direction * 7));
    setCurrentDate(newDate);
  };

  const getStartOfWeek = (date) => {
      const d = new Date(date);
      const day = d.getDay(); 
      const diff = d.getDate() - day; 
      return new Date(d.setDate(diff));
  };

  const renderMonthView = () => {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const firstDayOfMonth = new Date(year, month, 1).getDay();
      
      const cells = [];
      for (let i = 0; i < firstDayOfMonth; i++) cells.push(<div key={`empty-${i}`} style={{background:"#f9f9f9", border:"1px solid #eee"}}></div>);
      
      for (let d = 1; d <= daysInMonth; d++) {
          const currentCellDate = new Date(year, month, d);
          const dateStr = normalizeDate(currentCellDate); 
          const isToday = normalizeDate(new Date()) === dateStr;
          const isSaturday = currentCellDate.getDay() === 6; 
          
          const dayAppts = appointments.filter(a => normalizeDate(a.date) === dateStr && a.status !== "Cancelled" && a.status !== "Done");
          
          cells.push(
              <div key={d} style={{minHeight:"80px", background: isSaturday ? "#eeeeee" : (isToday ? "#e3f2fd" : "white"), border:"1px solid #eee", padding:"5px", opacity: isSaturday?0.6:1 }}>
                  <div style={{fontWeight:"bold", color: isSaturday?"red":(isToday?"#1565C0":"#333")}}>{d} {isSaturday&&"(Closed)"}</div>
                  <div style={{display:"flex", flexDirection:"column", gap:"2px", maxHeight: "60px", overflowY: "auto"}}>
                      {dayAppts.map(a => (
                          <div key={a.id} style={{background:a.status==='Pending'?'orange':'green', color:"white", padding:"2px", borderRadius:"3px", fontSize:"10px", overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis"}}>
                              {a.time} {a.petName}
                          </div>
                      ))}
                  </div>
              </div>
          );
      }
      return <div style={{display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:"5px", flex: 1, overflowY:"auto"}}>{cells}</div>;
  };

  const renderWeekView = () => {
      const startOfWeek = getStartOfWeek(currentDate);
      const days = [];
      for (let i = 0; i < 7; i++) {
          const d = new Date(startOfWeek);
          d.setDate(d.getDate() + i);
          days.push(new Date(d));
      }
      const hours = Array.from({length: 11}, (_, i) => i + 8); 

      return (
          <div style={{display: "flex", flexDirection: "column", height: "100%", overflowY: "auto", border: "1px solid #ddd"}}>
              <div style={{display: "grid", gridTemplateColumns: "60px repeat(7, 1fr)", background: "#f5f5f5", borderBottom: "1px solid #ddd", position: "sticky", top: 0, zIndex: 10}}>
                  <div style={{padding: "10px", fontWeight: "bold", borderRight: "1px solid #ddd"}}>Time</div>
                  {days.map(d => (
                      <div key={d.toString()} style={{padding: "10px", textAlign: "center", fontWeight: "bold", borderRight: "1px solid #ddd", color: d.getDay() === 6 ? 'red' : 'black', background: normalizeDate(d) === normalizeDate(new Date()) ? "#e3f2fd" : "transparent"}}>
                          {d.toLocaleDateString('en-US', {weekday: 'short'})} <br/> {d.getDate()}
                      </div>
                  ))}
              </div>
              {hours.map(h => (
                  <div key={h} style={{display: "grid", gridTemplateColumns: "60px repeat(7, 1fr)", borderBottom: "1px solid #eee"}}>
                      <div style={{padding: "10px", fontSize: "12px", borderRight: "1px solid #eee", textAlign: "right", color: "#666"}}>{h}:00</div>
                      {days.map(d => {
                          const dateStr = normalizeDate(d); 
                          const isSaturday = d.getDay() === 6;
                          const slotAppts = appointments.filter(a => {
                              if (a.status === 'Cancelled' || a.status === 'Done' || normalizeDate(a.date) !== dateStr) return false;
                              const apptHour = parseInt(a.time.split(':')[0]);
                              return apptHour === h;
                          });
                          return (
                              <div key={dateStr + h} style={{borderRight: "1px solid #eee", background: isSaturday ? "#f5f5f5" : "white", padding: "2px", minHeight: "50px", position: "relative"}}>
                                  {slotAppts.map(a => (
                                      <div key={a.id} onClick={() => openConsultModal(a.id)} style={{background: a.status === 'Pending' ? 'orange' : 'green', color: "white", fontSize: "11px", padding: "4px", borderRadius: "4px", marginBottom: "2px", cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.2)"}}>
                                          {a.time} - {a.petName}
                                      </div>
                                  ))}
                              </div>
                          );
                      })}
                  </div>
              ))}
          </div>
      );
  };

  const getNotifications = () => {
    let notifs = [];
    appointments.filter(a => a.status === 'Pending').forEach(a => {
        notifs.push({ id: a.id, type: 'appointment', subType: 'Pending', text: `New Request: ${a.petName} (${a.date})`, date: a.createdAt?.toDate ? a.createdAt.toDate() : new Date(), linkTab: 'appointments', linkSubTab: 'Pending' });
    });
    appointments.filter(a => a.status === 'Cancelled').slice(0, 5).forEach(a => {
        notifs.push({ id: a.id, type: 'appointment', subType: 'Cancelled', text: `Cancelled: ${a.petName}`, date: a.createdAt?.toDate ? a.createdAt.toDate() : new Date(), linkTab: 'appointments', linkSubTab: 'Cancelled' });
    });
    const unreadMsgs = allMessages.filter(m => m.senderId !== auth.currentUser.uid && !m.read && m.senderId !== "AI_BOT");
    const unreadOwners = [...new Set(unreadMsgs.map(m => m.senderId))];
    unreadOwners.forEach(ownerId => {
        const owner = owners.find(o => o.id === ownerId);
        notifs.push({ id: `msg-${ownerId}`, type: 'message', text: `Msg from ${owner ? owner.firstName : 'Client'}`, date: new Date(), linkTab: 'messages', ownerData: owner });
    });
    return notifs.sort((a, b) => b.date - a.date).filter(n => !readNotifIds.includes(n.id));
  };

  const notificationList = getNotifications();
  const unreadCount = notificationList.length;

  const handleNotificationClick = (notif) => {
      setReadNotifIds(prev => [...prev, notif.id]);
      setActiveTab(notif.linkTab);
      if (notif.linkSubTab) setApptSubTab(notif.linkSubTab);
      if (notif.type === 'message' && notif.ownerData) setSelectedChatOwner(notif.ownerData);
      setShowNotifications(false);
  };
  
  const handleMarkAllRead = () => { setReadNotifIds(prev => [...prev, ...notificationList.map(n => n.id)]); };
  
  const getTabStyle = (name) => ({
      padding: "15px",
      fontSize: "1.1rem",
      cursor: "pointer",
      border: "none",
      borderRadius: "12px",
      background: activeTab === name ? "#2196F3" : "white",
      color: activeTab === name ? "white" : "#555",
      boxShadow: activeTab === name ? "0 4px 10px rgba(33, 150, 243, 0.4)" : "0 2px 4px rgba(0,0,0,0.05)",
      fontWeight: "bold",
      transition: "all 0.2s",
      width: "100%",
      textAlign: "center"
  });

  const filteredAppointments = appointments.filter(a => a.status === apptSubTab);

  useEffect(() => {
      if (selectedChatOwner) {
          const currentMsgs = allMessages.filter(msg => msg.participants && msg.participants.includes(selectedChatOwner.id) && msg.type !== 'notification');
          setChatMessages(currentMsgs);
      }
  }, [selectedChatOwner, allMessages]);
  
  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  return (
    // --- 1. FULL SCREEN CONTAINER (Locked to 100vh, No Scroll) ---
    <div className="dashboard-container" style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f5f5" }}>
      
      {/* Toast Container */}
      {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({...toast, show: false})} />}

      {/* --- Navbar (Fixed Height) --- */}
      <nav className="navbar" style={{ flexShrink: 0 }}>
        <div className="logo"><img src={logoImg} alt="PawPals" className="logo-img" /> PawPals Staff</div>
        <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
            <div style={{ position: "relative" }}>
                <button onClick={() => setShowNotifications(!showNotifications)} style={{ background: "none", border: "none", fontSize: "24px", cursor: "pointer" }}>
                    🔔{unreadCount > 0 && <span style={{ position: "absolute", top: "-5px", right: "-5px", background: "red", color: "white", fontSize: "11px", borderRadius: "50%", padding: "3px 6px", fontWeight: "bold" }}>{unreadCount}</span>}
                </button>
                {showNotifications && (
                    <div style={{ position: "absolute", top: "50px", right: "0", width: "320px", background: "white", boxShadow: "0 5px 15px rgba(0,0,0,0.2)", borderRadius: "12px", zIndex: 1000, padding: "15px", border: "1px solid #eee" }}>
                        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px", borderBottom:"1px solid #eee", paddingBottom:"5px"}}>
                            <h4 style={{ margin: 0 }}>Notifications</h4>
                            <button onClick={handleMarkAllRead} style={{fontSize:"11px", border:"none", background:"none", color:"#2196F3", cursor:"pointer"}}>Mark all read</button>
                        </div>
                        <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                            {notificationList.length === 0 ? <p style={{color:"#888"}}>No new notifications.</p> : (
                                notificationList.map((notif, index) => (
                                    <div key={index} onClick={() => handleNotificationClick(notif)} style={{ padding: "12px", borderBottom: "1px solid #f1f1f1", cursor: "pointer", display: "flex", alignItems: "start", gap: "10px" }}>
                                        <span style={{ fontSize: "16px" }}>{notif.type === 'appointment' ? '📅' : notif.type === 'message' ? '💬' : '⭐'}</span>
                                        <div><div style={{ fontSize: "13px", fontWeight: "500", color: "#333" }}>{notif.text}</div></div>
                                    </div>
                                )))}
                        </div>
                    </div>
                )}
            </div>
            <button onClick={handleLogout} className="action-btn" style={{background: "#ffebee", color: "#d32f2f"}}>Logout</button>
        </div>
      </nav>

      {/* --- 2. MAIN CONTENT AREA (Flex Grow, No Scroll on parent) --- */}
      <main className="main-content" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "20px", maxWidth: "1200px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        
        {/* --- Tab Grid (Fixed Height) --- */}
        <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(4, 1fr)", 
            gap: "20px", 
            marginBottom: "20px", 
            flexShrink: 0 
        }}>
          <button style={getTabStyle("appointments")} onClick={() => setActiveTab("appointments")}>📅 Appointments</button>
          <button style={getTabStyle("records")} onClick={() => setActiveTab("records")}>📋 Pet Records</button>
          
          {/* UPDATED MESSAGE TAB WITH RED DOT */}
          <button style={getTabStyle("messages")} onClick={() => setActiveTab("messages")}>
              💬 Messages 
              {totalUnreadMessages > 0 && (
                  <span style={{background:"red", color:"white", borderRadius:"50%", padding:"2px 8px", fontSize:"12px", marginLeft:"5px"}}>
                      {totalUnreadMessages}
                  </span>
              )}
          </button>
          
          <button style={getTabStyle("reports")} onClick={() => setActiveTab("reports")}>📑 Reports</button>
        </div>

        {/* --- 3. DYNAMIC CONTENT WRAPPER (Flex Grow, Scroll Internal) --- */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            
            {activeTab === "appointments" && (
                <div className="card" style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: "20px", boxSizing: "border-box" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px", paddingBottom: "10px", borderBottom: "1px solid #eee", flexShrink: 0 }}>
                        <h3>Appointments Management</h3>
                        <div style={{display:"flex", gap:"10px"}}>
                            <button onClick={() => setShowWalkInModal(true)} style={{background:"#673AB7", color:"white", border:"none", padding:"8px 15px", borderRadius:"20px", cursor:"pointer", fontWeight: "bold"}}>+ Walk-In</button>
                            <div style={{display:"flex", background:"#f1f1f1", borderRadius:"20px", padding:"2px"}}>
                                <button onClick={() => {setApptViewMode("list")}} style={{background: apptViewMode === 'list' ? "white" : "transparent", color: apptViewMode==='list'?"black":"#777", border:"none", borderRadius:"18px", padding:"6px 15px", cursor:"pointer", boxShadow: apptViewMode==='list'?"0 2px 4px rgba(0,0,0,0.1)":"none"}}>List</button>
                                <button onClick={() => {setApptViewMode("calendar")}} style={{background: apptViewMode === 'calendar' ? "white" : "transparent", color: apptViewMode==='calendar'?"black":"#777", border:"none", borderRadius:"18px", padding:"6px 15px", cursor:"pointer", boxShadow: apptViewMode==='calendar'?"0 2px 4px rgba(0,0,0,0.1)":"none"}}>Calendar</button>
                            </div>
                        </div>
                    </div>

                    {apptViewMode === 'calendar' ? (
                        <div style={{flex: 1, display: "flex", flexDirection: "column", overflow: "hidden"}}>
                            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"15px", background:"#f8f9fa", padding:"10px", borderRadius:"8px", flexShrink: 0}}>
                                <div style={{display:"flex", gap:"10px"}}>
                                    <button onClick={() => setCalendarView("month")} style={{background: calendarView === 'month' ? "#2196F3" : "white", color: calendarView === 'month' ? "white" : "#333", border: "1px solid #ddd", padding: "5px 15px", borderRadius: "5px"}}>Month</button>
                                    <button onClick={() => setCalendarView("week")} style={{background: calendarView === 'week' ? "#2196F3" : "white", color: calendarView === 'week' ? "white" : "#333", border: "1px solid #ddd", padding: "5px 15px", borderRadius: "5px"}}>Week</button>
                                </div>
                                <div style={{display:"flex", alignItems:"center", gap:"15px"}}>
                                    <button onClick={() => handleDateNavigate(-1)} style={{background:"white", border:"1px solid #ddd", borderRadius:"50%", width:"30px", height:"30px", cursor:"pointer"}}>&lt;</button>
                                    <h3 style={{margin:0, width:"180px", textAlign:"center"}}>{calendarView === 'month' ? currentDate.toLocaleString('default', { month: 'long', year: 'numeric' }) : `Week of ${getStartOfWeek(currentDate).toLocaleDateString()}`}</h3>
                                    <button onClick={() => handleDateNavigate(1)} style={{background:"white", border:"1px solid #ddd", borderRadius:"50%", width:"30px", height:"30px", cursor:"pointer"}}>&gt;</button>
                                </div>
                                <button onClick={() => setCurrentDate(new Date())} style={{fontSize:"12px", background:"none", border:"1px solid #2196F3", color:"#2196F3", padding:"5px 10px", borderRadius:"5px"}}>Today</button>
                            </div>
                            {/* Calendar Content Area - Scrollable */}
                            <div style={{flex: 1, overflowY: "auto", display: "flex", flexDirection: "column"}}>
                                {calendarView === 'month' ? (<><div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "5px", marginBottom: "5px" }}>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} style={{textAlign:"center", fontWeight:"bold", padding:"5px", color: d === 'Sat' ? 'red' : 'black'}}>{d}</div>)}</div>{renderMonthView()}</>) : (renderWeekView())}
                            </div>
                            <div style={{marginTop:"10px", fontSize:"12px", color:"#555", display:"flex", gap:"15px", flexShrink: 0}}>
                                <span style={{display:"flex", alignItems:"center", gap:"5px"}}><div style={{width:"10px", height:"10px", background:"orange"}}></div> Pending</span>
                                <span style={{display:"flex", alignItems:"center", gap:"5px"}}><div style={{width:"10px", height:"10px", background:"green"}}></div> Approved</span>
                                <span style={{display:"flex", alignItems:"center", gap:"5px"}}><div style={{width:"10px", height:"10px", background:"#f5f5f5", border:"1px solid #ccc"}}></div> Closed</span>
                            </div>
                        </div>
                    ) : (
                        <div style={{flex: 1, display: "flex", flexDirection: "column", overflow: "hidden"}}>
                             <div style={{ display: "flex", gap: "10px", marginBottom: "15px", flexShrink: 0 }}>
                                <button onClick={() => setApptSubTab("Pending")} style={{ background: apptSubTab === "Pending" ? "orange" : "#eee", color: apptSubTab === "Pending" ? "white" : "#555", border: "none", padding: "8px 20px", borderRadius: "20px", cursor: "pointer", fontWeight: "bold" }}>Pending</button>
                                <button onClick={() => setApptSubTab("Approved")} style={{ background: apptSubTab === "Approved" ? "green" : "#eee", color: apptSubTab === "Approved" ? "white" : "#555", border: "none", padding: "8px 20px", borderRadius: "20px", cursor: "pointer", fontWeight: "bold" }}>Approved</button>
                                <button onClick={() => setApptSubTab("Done")} style={{ background: apptSubTab === "Done" ? "#2196F3" : "#eee", color: apptSubTab === "Done" ? "white" : "#555", border: "none", padding: "8px 20px", borderRadius: "20px", cursor: "pointer", fontWeight: "bold" }}>Completed</button>
                                <button onClick={() => setApptSubTab("Cancelled")} style={{ background: apptSubTab === "Cancelled" ? "red" : "#eee", color: apptSubTab === "Cancelled" ? "white" : "#555", border: "none", padding: "8px 20px", borderRadius: "20px", cursor: "pointer", fontWeight: "bold" }}>Cancelled</button>
                            </div>
                            <div style={{ flex: 1, overflowY: "auto" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                    <thead><tr style={{background:"#f9f9f9", textAlign:"left"}}><th style={{padding:"10px"}}>Request Date</th><th>Scheduled</th><th>Pet & Owner</th><th>Reason</th><th>Actions</th></tr></thead>
                                    <tbody>
                                        {filteredAppointments.length === 0 ? <tr><td colSpan="5" style={{textAlign:"center", color:"#999", padding:"20px"}}>No {apptSubTab} appointments.</td></tr> : filteredAppointments.map(a => (
                                            <tr key={a.id} style={{borderBottom:"1px solid #eee"}}>
                                                <td style={{padding:"10px", fontSize:"13px", color:"#666"}}>{a.createdAt?.toDate ? a.createdAt.toDate().toLocaleDateString() : "N/A"}</td>
                                                <td>{a.date} <br/><small>{a.time}</small></td>
                                                <td><strong>{a.petName}</strong> {a.type === "walk-in" && <span style={{fontSize:"10px", background:"#E1BEE7", color:"#4A148C", padding:"2px 6px", borderRadius:"4px", fontWeight:"bold"}}>Walk-in</span>}</td>
                                                <td>{a.reason}{a.status === "Cancelled" && a.cancellationReason && (<div style={{color:"red", fontSize:"11px", marginTop:"5px", fontStyle:"italic"}}>Reason: {a.cancellationReason}</div>)}</td>
                                                <td>
                                                    {a.status === "Pending" && <div style={{display:"flex", gap:"5px"}}><button onClick={() => handleStatusUpdate(a.id, "Approved")} style={{background:"green", color:"white", border:"none", padding:"5px 10px", borderRadius:"4px", cursor:"pointer"}}>Approve</button><button onClick={() => handleStatusUpdate(a.id, "Rejected")} style={{background:"red", color:"white", border:"none", padding:"5px 10px", borderRadius:"4px", cursor:"pointer"}}>Reject</button></div>}
                                                    {a.status === "Approved" && <button onClick={() => openConsultModal(a.id)} style={{background:"#2196F3", color:"white", border:"none", padding:"5px 10px", borderRadius:"4px", cursor:"pointer"}}>Start Consult</button>}
                                                    {a.status === "Done" && <span style={{color:"green", fontWeight:"bold"}}>Completed</span>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === "records" && (
                 <div className="card" style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
                    <h3>Pet Records</h3>
                    <div style={{marginBottom:"15px", flexShrink: 0}}><input type="text" placeholder="Search Pet or Owner Name..." value={petSearch} onChange={(e) => setPetSearch(e.target.value)} style={{padding:"10px", width:"300px", borderRadius:"20px", border:"1px solid #ccc"}} /></div>
                    <div style={{flex: 1, overflowY: "auto"}}>
                        <table style={{width: "100%", borderCollapse: "collapse"}}>
                            <thead>
                                <tr style={{background:"#f1f1f1", textAlign:"left"}}>
                                    <th style={{padding:"10px", position: "sticky", top: 0, background: "#f1f1f1", zIndex: 10, borderBottom: "1px solid #ddd"}}>Pet Name</th>
                                    <th style={{position: "sticky", top: 0, background: "#f1f1f1", zIndex: 10, borderBottom: "1px solid #ddd"}}>Species</th>
                                    <th style={{position: "sticky", top: 0, background: "#f1f1f1", zIndex: 10, borderBottom: "1px solid #ddd"}}>Breed</th>
                                    <th style={{position: "sticky", top: 0, background: "#f1f1f1", zIndex: 10, borderBottom: "1px solid #ddd"}}>Owner Name</th>
                                    <th style={{position: "sticky", top: 0, background: "#f1f1f1", zIndex: 10, borderBottom: "1px solid #ddd"}}>Owner Phone</th>
                                    <th style={{position: "sticky", top: 0, background: "#f1f1f1", zIndex: 10, borderBottom: "1px solid #ddd"}}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRecords.length === 0 ? <tr><td colSpan="6" style={{textAlign:"center", padding:"20px"}}>No records found matching "{petSearch}".</td></tr> : filteredRecords.map(pet => {
                                    const owner = owners.find(o => o.id === pet.ownerId);
                                    return (
                                        <tr key={pet.id} style={{borderBottom:"1px solid #eee"}}><td style={{fontWeight:"bold", padding:"10px"}}>{pet.name}</td><td>{pet.species}</td><td>{pet.breed}</td><td>{owner ? `${owner.firstName} ${owner.lastName}` : "Unknown"}</td><td style={{color:"#555"}}>{owner?.phone || "N/A"}</td><td><button onClick={() => setViewingPet(pet)} style={{background:"#2196F3", color:"white", border:"none", padding:"8px 15px", borderRadius:"20px", cursor:"pointer"}}>View</button></td></tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                 </div>
            )}

            {activeTab === "messages" && (
                <div className="chat-layout" style={{ height: "100%", display: "grid", gridTemplateColumns: "300px 1fr", border: "1px solid #ccc", borderRadius: "12px", overflow: "hidden", background: "white" }}>
                    <div className="chat-sidebar" style={{ borderRight: "1px solid #eee", background: "#f9f9f9", overflowY: "auto" }}>
                        <div style={{ padding: "15px", fontWeight: "bold", borderBottom: "1px solid #ddd", background: "white", position: "sticky", top: 0, zIndex: 1 }}>Registered Owners</div>
                        {owners.map(owner => {
                            const unreadCount = getUnreadCount(owner.id);
                            return (
                                <div key={owner.id} onClick={() => {setSelectedChatOwner(owner); setEditingMessageId(null); setChatInput("");}} style={{ padding: "15px", cursor: "pointer", background: selectedChatOwner?.id === owner.id ? "#e3f2fd" : "transparent", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between" }}><span>{owner.firstName} {owner.lastName}</span>{unreadCount > 0 && <span style={{background:"red", color:"white", borderRadius:"50%", padding:"2px 6px", fontSize:"11px"}}>{unreadCount}</span>}</div>
                            );
                        })}
                    </div>
                    <div className="chat-window" style={{ display: "flex", flexDirection: "column", background: "white", overflow: "hidden" }}>
                        {!selectedChatOwner ? <div style={{padding:"20px", color:"#888", textAlign:"center", marginTop:"200px"}}>Select an owner to start chatting</div> : (
                            <>
                                <div style={{ padding: "15px", borderBottom: "1px solid #eee", fontWeight: "bold", background:"#f8f9fa", flexShrink: 0 }}>Chat with {selectedChatOwner.firstName}</div>
                                <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
                                    {chatMessages.map(msg => {
                                        const dateObj = msg.createdAt?.toDate ? msg.createdAt.toDate() : new Date(msg.createdAt);
                                        const timeString = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                        
                                        return (
                                            <div key={msg.id} style={{ alignSelf: msg.senderId === auth.currentUser.uid ? "flex-end" : "flex-start", maxWidth: "70%" }}>
                                                {msg.senderId === "AI_BOT" && <span style={{fontSize:"10px", color:"#888", display:"block", marginBottom:"2px"}}>🤖 System Auto-Reply</span>}
                                                <div style={{ background: msg.senderId === auth.currentUser.uid ? "#2196F3" : (msg.senderId === "AI_BOT" ? "#F5F5F5" : "#f1f1f1"), color: msg.senderId === auth.currentUser.uid ? "white" : (msg.senderId === "AI_BOT" ? "#666" : "black"), padding: "10px", borderRadius: "12px", fontSize: "14px", fontStyle: msg.senderId === "AI_BOT" ? "italic" : "normal", border: msg.senderId === "AI_BOT" ? "1px solid #ddd" : "none" }}>
                                                    {msg.text}
                                                    {msg.isEdited && <span style={{fontSize:"10px", marginLeft:"5px", fontStyle:"italic", opacity:0.7}}>(edited)</span>}
                                                    <div style={{fontSize:"10px", marginTop:"5px", textAlign:"right", opacity:0.7, color: msg.senderId === auth.currentUser.uid ? "white" : "black"}}>{timeString}</div>
                                                </div>
                                                {msg.senderId === auth.currentUser.uid && <div style={{fontSize:"10px", textAlign:"right", marginTop:"2px", color:"#888", cursor:"pointer"}} onClick={() => handleStartEdit(msg)}>Edit</div>}
                                            </div>
                                        );
                                    })}
                                    <div ref={scrollRef}></div>
                                </div>
                                <form onSubmit={handleSendMessage} style={{ padding: "15px", borderTop: "1px solid #eee", display: "flex", gap: "10px", background: "white", flexShrink: 0 }}>
                                    {editingMessageId && <button type="button" onClick={handleCancelEdit} style={{background: "#ccc", border: "none", borderRadius: "50%", width: "30px", height: "30px", cursor: "pointer", fontWeight: "bold"}}>✖</button>}
                                    <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Type message..." style={{flex:1, padding: "12px", borderRadius: "30px", border: "1px solid #ddd", outline: "none"}} />
                                    <button className="action-btn" style={{background: editingMessageId ? "#FF9800" : "#2196F3", color:"white", borderRadius: "30px", padding: "0 25px"}}>{editingMessageId ? "Update" : "Send"}</button>
                                </form>
                            </>
                        )}
                    </div>
                </div>
            )}

            {activeTab === "reports" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "25px", alignItems: "start", height: "100%", overflow: "hidden" }}>
                    <div className="card"><h3>{editingReportId ? "Edit Report" : "New Report"}</h3><form onSubmit={handleSaveReport}><input type="text" placeholder="Title" value={reportTitle} onChange={e => setReportTitle(e.target.value)} required style={{width:"100%", padding:"10px", marginBottom:"10px", borderRadius:"5px", border:"1px solid #ccc"}} /><textarea placeholder="Content..." rows="8" value={reportContent} onChange={e => setReportContent(e.target.value)} required style={{width:"100%", padding:"10px", borderRadius:"5px", border:"1px solid #ccc", fontFamily:"inherit"}}></textarea><button type="submit" className="action-btn" style={{background:"#FF9800", color:"white", width:"100%", marginTop:"10px"}}>{editingReportId ? "Update" : "Create"}</button></form></div>
                    <div className="card" style={{height: "100%", display: "flex", flexDirection: "column"}}><div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"15px", flexShrink: 0}}><h3 style={{margin:0}}>Report History</h3><input type="text" placeholder="🔍 Search" value={reportSearch} onChange={(e) => setReportSearch(e.target.value)} style={{padding:"8px", borderRadius:"15px", border:"1px solid #ddd", width:"200px"}} /></div><div style={{flex: 1, overflowY:"auto"}}>{filteredReports.map(r => (<div key={r.id} style={{padding:"15px", border:"1px solid #eee", marginBottom:"10px", borderRadius:"8px", background:"#fafafa"}}><div style={{display:"flex", justifyContent:"space-between"}}><strong>{r.title}</strong><span style={{fontSize:"12px", color:"#888"}}>{r.date}</span></div><p style={{fontSize:"13px", color:"#555", margin:"10px 0"}}>{r.content}</p><div style={{display:"flex", gap:"10px"}}><button onClick={() => handleEditClick(r)} style={{fontSize:"12px", cursor:"pointer", border:"none", background:"none", color:"#2196F3"}}>Edit</button><button onClick={() => handleDeleteReport(r.id)} style={{fontSize:"12px", cursor:"pointer", border:"none", background:"none", color:"red"}}>Delete</button></div></div>))}</div></div>
                </div>
            )}
        </div>

        {/* --- MODALS (Fixed Position, Z-Index handled) --- */}
        {showConsultModal && (
            <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 }}>
                <div style={{ background: "white", padding: "30px", borderRadius: "15px", width: "500px", boxShadow: "0 10px 30px rgba(0,0,0,0.2)", maxHeight: "90vh", overflowY: "auto" }}>
                    <h3 style={{ marginTop: 0, borderBottom: "1px solid #eee", paddingBottom: "10px" }}>Consultation Details</h3>
                    <form onSubmit={handleFinishConsultation}>
                         <div style={{marginBottom: "10px"}}>
                            <label style={{display:"block", marginBottom:"5px", fontWeight:"bold", fontSize:"13px"}}>Date of Visit</label>
                            {/* UPDATED: Automatically set to scheduled date */}
                            <input type="date" required value={consultData.date} onChange={(e) => setConsultData({ ...consultData, date: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "5px", border: "1px solid #ccc" }} />
                         </div>
                         
                         {/* REASON DROP-DOWN */}
                         <div style={{marginBottom: "10px"}}>
                            <label style={{display:"block", marginBottom:"5px", fontWeight:"bold", fontSize:"13px"}}>Reason for Visit</label>
                            <select required value={consultData.reason} onChange={(e) => setConsultData({ ...consultData, reason: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "5px", border: "1px solid #ccc" }}>
                                <option value="">-- Select Reason --</option>
                                {VISIT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                         </div>
                         
                         {/* SYMPTOMS CHECKBOXES */}
                         <div style={{marginBottom: "10px"}}>
                            <label style={{display:"block", marginBottom:"5px", fontWeight:"bold", fontSize:"13px"}}>Symptoms (Select all that apply)</label>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px", maxHeight: "120px", overflowY: "auto", border: "1px solid #eee", padding: "10px", borderRadius: "5px" }}>
                                {SYMPTOM_OPTIONS.map(symptom => (
                                    <label key={symptom} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", cursor: "pointer" }}>
                                        <input 
                                            type="checkbox" 
                                            checked={consultData.symptoms.includes(symptom)} 
                                            onChange={() => handleSymptomChange(symptom)}
                                        />
                                        {symptom}
                                    </label>
                                ))}
                            </div>
                         </div>

                         {/* DIAGNOSIS DROP-DOWN */}
                         <div style={{marginBottom: "10px"}}>
                            <label style={{display:"block", marginBottom:"5px", fontWeight:"bold", fontSize:"13px"}}>Diagnosis</label>
                            <select required value={consultData.diagnosis} onChange={(e) => setConsultData({ ...consultData, diagnosis: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "5px", border: "1px solid #ccc" }}>
                                <option value="">-- Select Diagnosis --</option>
                                {DIAGNOSIS_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                                <option value="Other">Other (Specify in Notes)</option>
                            </select>
                         </div>

                         <div style={{marginBottom: "10px"}}>
                            <label style={{display:"block", marginBottom:"5px", fontWeight:"bold", fontSize:"13px"}}>Medications Prescribed</label>
                            <input type="text" value={consultData.medicine} onChange={(e) => setConsultData({ ...consultData, medicine: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "5px", border: "1px solid #ccc" }} />
                         </div>
                         
                         <div style={{marginBottom: "10px"}}>
                            <label style={{display:"block", marginBottom:"5px", fontWeight:"bold", fontSize:"13px"}}>Notes</label>
                            <textarea value={consultData.notes} onChange={(e) => setConsultData({ ...consultData, notes: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "5px", border: "1px solid #ccc" }} rows="2" placeholder="Additional observations..." />
                         </div>

                         <div style={{marginTop:"15px", borderTop: "1px solid #eee", paddingTop: "10px"}}><label style={{display:"block", marginBottom:"5px", fontWeight:"bold", fontSize:"13px", color:"#2196F3"}}>Schedule Follow-up (Optional)</label><input type="date" min={new Date().toISOString().split('T')[0]} value={consultData.followUp} onChange={(e) => setConsultData({ ...consultData, followUp: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "5px", border: "1px solid #ccc" }} /></div>
                         <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}><button type="submit" className="action-btn" style={{ background: "#4CAF50", color: "white", flex: 1 }}>Complete</button><button type="button" onClick={() => setShowConsultModal(false)} className="action-btn" style={{ background: "#ccc", color: "black", flex: 1 }}>Cancel</button></div>
                    </form>
                </div>
            </div>
        )}

        {showWalkInModal && (
            <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 }}>
                <div style={{ background: "white", padding: "30px", borderRadius: "15px", width: "400px", boxShadow: "0 10px 30px rgba(0,0,0,0.2)" }}>
                    <h3 style={{ marginTop: 0, borderBottom: "1px solid #eee", paddingBottom: "10px" }}>New Walk-In Appointment</h3>
                    <form onSubmit={handleCreateWalkIn}>
                        <div style={{marginBottom:"10px"}}>
                            <label style={{fontWeight:"bold", fontSize:"12px"}}>Select Owner</label>
                            <select required value={walkInData.ownerId} onChange={e => setWalkInData({...walkInData, ownerId: e.target.value})} style={{width:"100%", padding:"8px"}}>
                                <option value="">-- Choose Owner --</option>
                                {owners.map(o => <option key={o.id} value={o.id}>{o.firstName} {o.lastName}</option>)}
                            </select>
                        </div>
                        <div style={{marginBottom:"10px"}}>
                            <label style={{fontWeight:"bold", fontSize:"12px"}}>Pet Name</label>
                            <input type="text" required value={walkInData.petName} onChange={e => setWalkInData({...walkInData, petName: e.target.value, petId: "WALKIN_"+Date.now()})} style={{width:"100%", padding:"8px"}} />
                        </div>
                        <div style={{display:"flex", gap:"10px", marginBottom:"10px"}}>
                            <div style={{flex:1}}>
                                <label style={{fontWeight:"bold", fontSize:"12px"}}>Date</label>
                                <input type="date" required value={walkInData.date} onChange={e => setWalkInData({...walkInData, date: e.target.value})} style={{width:"100%", padding:"8px"}} />
                                <div style={{fontSize:"10px", color:"red"}}>*Closed Saturdays</div>
                            </div>
                            <div style={{flex:1}}>
                                <label style={{fontWeight:"bold", fontSize:"12px"}}>Time</label>
                                <input type="time" required value={walkInData.time} onChange={e => setWalkInData({...walkInData, time: e.target.value})} style={{width:"100%", padding:"8px"}} />
                            </div>
                        </div>
                        <div style={{marginBottom:"15px"}}>
                            <label style={{fontWeight:"bold", fontSize:"12px"}}>Reason</label>
                            <input type="text" required value={walkInData.reason} onChange={e => setWalkInData({...walkInData, reason: e.target.value})} style={{width:"100%", padding:"8px"}} />
                        </div>
                        <div style={{ display: "flex", gap: "10px" }}>
                            <button type="submit" className="action-btn" style={{ background: "#673AB7", color: "white", flex: 1 }}>Confirm</button>
                            <button type="button" onClick={() => setShowWalkInModal(false)} className="action-btn" style={{ background: "#eee", color: "#333", flex: 1 }}>Cancel</button>
                        </div>
                     </form>
                 </div>
             </div>
         )}

         {viewingPet && (
             <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 }}>
                 <div style={{ background: "white", padding: "30px", borderRadius: "15px", width: "500px", boxShadow: "0 10px 30px rgba(0,0,0,0.2)", maxHeight: "90vh", overflowY: "auto" }}>
                     <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", borderBottom:"1px solid #eee", paddingBottom:"10px", marginBottom:"15px"}}>
                         <h3 style={{ margin: 0 }}>{viewingPet.name}</h3>
                         <button onClick={() => setViewingPet(null)} style={{background:"none", border:"none", fontSize:"20px", cursor:"pointer"}}>✖</button>
                     </div>
                     <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"15px", marginBottom:"20px"}}>
                         <div><strong>Species:</strong> {viewingPet.species}</div>
                         <div><strong>Breed:</strong> {viewingPet.breed}</div>
                         <div><strong>Age:</strong> {viewingPet.age} {viewingPet.ageUnit || "Years"}</div>
                         <div><strong>Gender:</strong> {viewingPet.gender}</div>
                     </div>
                     <div style={{background:"#fff3e0", padding:"15px", borderRadius:"8px", marginBottom:"20px", border:"1px solid #ffe0b2"}}>
                         <h4 style={{margin:"0 0 5px 0", color:"#e65100"}}>🏥 Medical History (Previous)</h4>
                         <p style={{margin:0, fontSize:"14px", whiteSpace:"pre-wrap"}}>{viewingPet.medicalHistory || "No previous history recorded."}</p>
                     </div>
                     <h4 style={{borderBottom:"1px solid #eee", paddingBottom:"5px"}}>Clinic Visits</h4>
                     <div style={{maxHeight:"200px", overflowY:"auto"}}>
                         {appointments.filter(a => a.petId === viewingPet.id && a.status === "Done").length === 0 ? <p style={{color:"#888"}}>No completed visits yet.</p> : (
                             appointments.filter(a => a.petId === viewingPet.id && a.status === "Done").map(a => (
                                 <div key={a.id} style={{padding:"10px", borderBottom:"1px solid #f0f0f0", fontSize:"13px"}}>
                                     <div style={{fontWeight:"bold"}}>{a.date} - {a.reason}</div>
                                     <div style={{color:"#555", marginTop:"2px"}}><strong>Sx:</strong> {a.symptoms || "N/A"}</div>
                                     <div style={{color:"#555"}}><strong>Dx:</strong> {a.diagnosis}</div>
                                     <div style={{color:"#555"}}><strong>Rx:</strong> {a.medicine}</div>
                                     <div style={{color:"#777", fontStyle:"italic", fontSize:"12px"}}><strong>Notes:</strong> {a.notes || "N/A"}</div>
                                 </div>
                             ))
                         )}
                     </div>
                     <button onClick={() => setViewingPet(null)} style={{width:"100%", marginTop:"20px", padding:"10px", background:"#eee", border:"none", borderRadius:"8px", cursor:"pointer"}}>Close</button>
                 </div>
             </div>
         )}

      </main>
    </div>
  );
};

export default StaffDashboard;
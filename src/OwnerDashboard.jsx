import { useEffect, useState, useRef } from "react";
import { auth, db } from "./firebase";
import { signOut } from "firebase/auth";
import { collection, addDoc, query, where, onSnapshot, orderBy, doc, updateDoc, getDoc, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import logoImg from './logo.png';

// --- PREDEFINED BREED LISTS ---
const DOG_BREEDS = [
  "Aspin (Asong Pinoy)", "Beagle", "Bulldog", "Chihuahua", "Dachshund", 
  "German Shepherd", "Golden Retriever", "Labrador", "Poodle", "Pug", 
  "Rottweiler", "Shih Tzu", "Siberian Husky", "Mixed / Unknown", "Other"
];

const CAT_BREEDS = [
  "Puspin (Pusang Pinoy)", "Bengal", "British Shorthair", "Maine Coon", 
  "Persian", "Ragdoll", "Russian Blue", "Scottish Fold", "Siamese", 
  "Sphynx", "Mixed / Unknown", "Other"
];

const OwnerDashboard = () => {
  const navigate = useNavigate();
  const user = auth.currentUser;
  const scrollRef = useRef();

  const [activeTab, setActiveTab] = useState("pets");
  const [apptFilter, setApptFilter] = useState("Pending");

  // Data States
  const [myPets, setMyPets] = useState([]);
  const [myAppointments, setMyAppointments] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatMessages, setChatMessages] = useState([]);
  
  // UI States
  const [chatInput, setChatInput] = useState("");
  const [petSearch, setPetSearch] = useState("");
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  
  // --- CHAT EDIT STATE ---
  const [editingMessageId, setEditingMessageId] = useState(null);

  // --- MODAL STATES ---
  const [showPetModal, setShowPetModal] = useState(false);
  const [isEditingPet, setIsEditingPet] = useState(false);
  const [editingPetId, setEditingPetId] = useState(null);

  // --- MEDICAL RECORD MODAL STATES ---
  const [showMedicalModal, setShowMedicalModal] = useState(false); // For single appt
  const [selectedRecord, setSelectedRecord] = useState(null);

  // --- PET HISTORY MODAL STATES ---
  const [showHistoryModal, setShowHistoryModal] = useState(false); // For full pet history
  const [historyPet, setHistoryPet] = useState(null);

  // --- RESCHEDULE STATE ---
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleData, setRescheduleData] = useState({ id: null, date: new Date(), time: "08:00" });

  // Profile Data
  const [profileData, setProfileData] = useState({ firstName: "", lastName: "", email: "", phone: "", address: "" });
  
  // --- PET FORM DATA ---
  const [petName, setPetName] = useState("");
  const [species, setSpecies] = useState("Dog");
  const [otherSpecies, setOtherSpecies] = useState(""); 
  const [breed, setBreed] = useState("");
  const [otherBreed, setOtherBreed] = useState(""); 
  const [age, setAge] = useState("");
  const [ageUnit, setAgeUnit] = useState("Years");
  const [gender, setGender] = useState("Male");
  const [medicalHistory, setMedicalHistory] = useState("");
  
  const [selectedPetId, setSelectedPetId] = useState("");
  const [apptDate, setApptDate] = useState(new Date());
  const [apptTime, setApptTime] = useState("08:00");

  // --- DATA FETCHING ---
  useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
          const docSnap = await getDoc(doc(db, "users", user.uid));
          if (docSnap.exists()) {
              setProfileData(docSnap.data());
          }
      };
      fetchProfile();

      const qPets = query(collection(db, "pets"), where("ownerId", "==", user.uid));
      const unsubPets = onSnapshot(qPets, (snap) => {
        const petsData = snap.docs
            .map(doc => ({ ...doc.data(), id: doc.id }))
            .filter(pet => !pet.isArchived);

        setMyPets(petsData);
        if (petsData.length > 0 && !selectedPetId) setSelectedPetId(petsData[0].id);
      });

      const qAppts = query(collection(db, "appointments"), where("ownerId", "==", user.uid));
      const unsubAppts = onSnapshot(qAppts, (snap) => {
        const appts = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        appts.sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
            return dateB - dateA;
        });
        setMyAppointments(appts);
        const alerts = appts.filter(a => a.status !== "Pending").map(a => ({
            id: a.id, type: "alert", text: `Your appointment for ${a.petName} on ${a.date} is ${a.status}.`, isSeenByOwner: a.isSeenByOwner 
        }));
        setNotifications(alerts);
        setUnreadCount(alerts.filter(a => !a.isSeenByOwner).length);
      });

      const qChat = query(collection(db, "messages"), orderBy("createdAt", "asc"));
      const unsubChat = onSnapshot(qChat, (snap) => {
          const msgs = snap.docs.map(doc => ({...doc.data(), id: doc.id}))
            .filter(m => m.participants && m.participants.includes(user.uid) && m.type === "chat");
          setChatMessages(msgs);
      });

      return () => { unsubPets(); unsubAppts(); unsubChat(); };
    }
  }, [user, selectedPetId]);

  useEffect(() => {
    if (activeTab === "chat") scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, activeTab]);

  // Filters
  const filteredPets = myPets.filter(pet => pet.name.toLowerCase().includes(petSearch.toLowerCase()));
  
  const filteredAppointments = myAppointments.filter(appt => {
      return appt.status === apptFilter;
  });

  // --- ACTIONS ---

  const handleToggleNotifications = () => {
      setShowNotifDropdown(!showNotifDropdown);
      if (!showNotifDropdown && unreadCount > 0) {
          notifications.filter(n => !n.isSeenByOwner).forEach(async (item) => {
              await updateDoc(doc(db, "appointments", item.id), { isSeenByOwner: true });
          });
      }
  };

  const handleRequestDelete = async (petId, petName) => {
      const reason = window.prompt(`Why do you want to delete ${petName}? (Required for Admin Approval)`);
      if (reason) {
          try {
              await updateDoc(doc(db, "pets", petId), { deletionStatus: "Pending", deletionReason: reason });
              alert("Deletion request sent to Admin for approval.");
          } catch (error) { console.error(error); alert("Error sending request."); }
      }
  };

  const handleCancelAppointment = async (apptId) => {
      const reason = window.prompt("Please provide a reason for cancellation:");
      if (reason) {
          await updateDoc(doc(db, "appointments", apptId), { 
              status: "Cancelled",
              cancellationReason: reason 
          });
          alert("Appointment Cancelled.");
      }
  };

  const handleViewMedicalRecord = (appt) => {
      setSelectedRecord(appt);
      setShowMedicalModal(true);
  };

  const handleViewHistory = (pet) => {
      setHistoryPet(pet);
      setShowHistoryModal(true);
  };

  // --- RESCHEDULE LOGIC ---
  const openRescheduleModal = (appt) => {
      setRescheduleData({
          id: appt.id,
          date: new Date(appt.date),
          time: appt.time
      });
      setShowRescheduleModal(true);
  };

  const handleRescheduleSubmit = async (e) => {
      e.preventDefault();
      const now = new Date();
      const selectedDateTime = new Date(rescheduleData.date);
      const [hours, minutes] = rescheduleData.time.split(':');
      selectedDateTime.setHours(hours, minutes, 0, 0);

      if (selectedDateTime.getDay() === 6) return alert("Sorry, the clinic is closed on Saturdays.");
      if (selectedDateTime < now) return alert("Please select a future date and time.");

      const formattedDate = rescheduleData.date.toDateString();
      const qConflict = query(collection(db, "appointments"), where("date", "==", formattedDate), where("time", "==", rescheduleData.time));
      const snapshot = await getDocs(qConflict);
      const hasConflict = snapshot.docs.some(doc => {
          if (doc.id === rescheduleData.id) return false;
          return doc.data().status !== "Cancelled" && doc.data().status !== "Rejected";
      });

      if (hasConflict) return alert(`CONFLICT: ${rescheduleData.time} is already booked.`);

      await updateDoc(doc(db, "appointments", rescheduleData.id), {
          date: formattedDate,
          time: rescheduleData.time,
          status: "Pending",
          isSeenByOwner: false
      });
      alert("Appointment Rescheduled! It is now Pending approval.");
      setShowRescheduleModal(false);
  };

  const handleSaveProfile = async (e) => {
      e.preventDefault();
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { firstName: profileData.firstName, lastName: profileData.lastName, phone: profileData.phone || "", address: profileData.address || "" });
      alert("Profile Information Updated!"); 
  };

  const resetPetForm = () => {
    setPetName(""); setBreed(""); setOtherBreed(""); setAge(""); setAgeUnit("Years");
    setOtherSpecies(""); setSpecies("Dog"); setGender("Male"); setMedicalHistory(""); 
    setIsEditingPet(false); setEditingPetId(null);
  };

  const openAddPetModal = () => { resetPetForm(); setShowPetModal(true); };

  const openEditPetModal = (pet) => {
    setPetName(pet.name); setAge(pet.age); setAgeUnit(pet.ageUnit || "Years");
    setGender(pet.gender); setMedicalHistory(pet.medicalHistory || ""); 
    setEditingPetId(pet.id); setIsEditingPet(true);

    if (["Dog", "Cat"].includes(pet.species)) {
        setSpecies(pet.species); setOtherSpecies("");
    } else {
        setSpecies("Other"); setOtherSpecies(pet.species);
    }

    if (DOG_BREEDS.includes(pet.breed) || CAT_BREEDS.includes(pet.breed)) {
        setBreed(pet.breed); setOtherBreed("");
    } else {
        if (pet.species === "Dog" || pet.species === "Cat") { setBreed("Other"); setOtherBreed(pet.breed); } 
        else { setBreed(pet.breed); }
    }
    setShowPetModal(true);
  };

  const handlePetSubmit = async (e) => {
    e.preventDefault();
    const finalSpecies = species === "Other" ? otherSpecies : species;
    if (!finalSpecies.trim()) return alert("Please specify the species.");

    let finalBreed = breed;
    if (["Dog", "Cat"].includes(species)) {
        if (breed === "Other") finalBreed = otherBreed;
        if (!finalBreed.trim()) return alert("Please specify the breed.");
    } else {
        if (!finalBreed || !finalBreed.trim()) finalBreed = "N/A";
    }

    const petData = { 
        name: petName, species: finalSpecies, breed: finalBreed, 
        age: Number(age), ageUnit, gender, medicalHistory, ownerId: user.uid, updatedAt: new Date()
    };

    if (isEditingPet && editingPetId) {
        await updateDoc(doc(db, "pets", editingPetId), petData);
        alert("Pet Updated Successfully!");
    } else {
        petData.createdAt = new Date();
        await addDoc(collection(db, "pets"), petData);
        alert("Pet Added Successfully!");
    }
    setShowPetModal(false); resetPetForm();
  };
  
  const handleBookAppointment = async (e) => {
      e.preventDefault();
      if (!selectedPetId) return alert("Please add a pet first!");
      
      const now = new Date();
      const selectedDateTime = new Date(apptDate);
      const [hours, minutes] = apptTime.split(':');
      selectedDateTime.setHours(hours, minutes, 0, 0);

      if (selectedDateTime.getDay() === 6) return alert("Sorry, the clinic is closed on Saturdays.");
      if (selectedDateTime < now) return alert("Please select a future date and time.");

      const pet = myPets.find(p => p.id === selectedPetId);
      const formattedDate = apptDate.toDateString();

      const qConflict = query(collection(db, "appointments"), where("date", "==", formattedDate), where("time", "==", apptTime));
      const snapshot = await getDocs(qConflict);
      const hasConflict = snapshot.docs.some(doc => doc.data().status !== "Cancelled" && doc.data().status !== "Rejected");

      if (hasConflict) return alert(`CONFLICT: ${apptTime} is already booked.`);

      await addDoc(collection(db, "appointments"), {
          ownerId: user.uid, petId: selectedPetId, petName: pet ? pet.name : "Unknown",
          date: formattedDate, time: apptTime, reason: "Check-up", status: "Pending", createdAt: new Date(), isSeenByOwner: false
      });
      alert("Appointment Requested!");
      setApptFilter("Pending");
  };

  // --- UPDATED CHAT HANDLER ---
  const handleStartEdit = (msg) => { setEditingMessageId(msg.id); setChatInput(msg.text); };
  const handleCancelEdit = () => { setEditingMessageId(null); setChatInput(""); };

  const handleSendMessage = async (e) => { 
      e.preventDefault(); 
      if(!chatInput.trim()) return; 

      if (editingMessageId) {
          await updateDoc(doc(db, "messages", editingMessageId), { text: chatInput, isEdited: true });
          setEditingMessageId(null);
          setChatInput("");
          return;
      }

      await addDoc(collection(db, "messages"), { 
          text: chatInput, senderId: user.uid, senderName: "Owner", receiverId: "STAFF_global", createdAt: new Date(), participants: [user.uid], type: "chat", read: false 
      }); 

      setChatInput(""); 

      // --- AUTO-REPLY LOGIC ---
      const lastMsg = chatMessages[chatMessages.length - 1];
      const isStartOfConversation = chatMessages.length === 0;
      let shouldTriggerBot = false;

      if (isStartOfConversation) {
          shouldTriggerBot = true;
      } else {
          const lastWasStaff = lastMsg.senderId !== user.uid && lastMsg.senderId !== "AI_BOT";
          const lastMsgTime = lastMsg.createdAt?.toDate ? lastMsg.createdAt.toDate() : new Date(lastMsg.createdAt);
          const now = new Date();
          const diffInHours = (now - lastMsgTime) / (1000 * 60 * 60);
          if (lastWasStaff || diffInHours >= 2) shouldTriggerBot = true;
      }

      if (shouldTriggerBot) {
          setTimeout(async () => {
              await addDoc(collection(db, "messages"), {
                  text: "Thank you for contacting us! 🐾 Our staff has been notified and will reply shortly. In the meantime, feel free to browse our services.",
                  senderId: "AI_BOT", senderName: "PawPals Assistant", receiverId: user.uid, createdAt: new Date(), participants: [user.uid], type: "chat", read: true
              });
          }, 1000);
      }
  };

  const handleLogout = async () => { await signOut(auth); navigate("/"); };

  const incomingMsgCount = chatMessages.filter(m => m.senderId !== user?.uid && !m.read).length;
  
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

  if (!user) return <div style={{padding:"50px", textAlign:"center"}}>Loading user data...</div>;

  return (
    <div className="dashboard-container" style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f5f5" }}>
      
      {/* --- Navbar (Fixed Height) --- */}
      <nav className="navbar" style={{ flexShrink: 0 }}>
        <div className="logo"><img src={logoImg} alt="PawPals" className="logo-img" /> PawPals Owner</div>
        <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
            <div style={{ position: "relative" }}>
                <button onClick={handleToggleNotifications} style={{ background: "none", border: "none", fontSize: "24px", cursor: "pointer" }}>
                    🔔{unreadCount > 0 && <span style={{ position: "absolute", top: "-5px", right: "-5px", background: "red", color: "white", fontSize: "11px", borderRadius: "50%", padding: "3px 6px", fontWeight: "bold" }}>{unreadCount}</span>}
                </button>
                {showNotifDropdown && (
                    <div style={{ position: "absolute", top: "50px", right: "0", width: "300px", background: "white", boxShadow: "0 5px 15px rgba(0,0,0,0.2)", borderRadius: "12px", zIndex: 1000, padding: "15px", border: "1px solid #eee" }}>
                        <h4 style={{ margin: "0 0 10px 0", borderBottom: "1px solid #eee", paddingBottom: "5px" }}>Notifications</h4>
                        <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                            {notifications.length === 0 ? <p style={{color:"#888"}}>No updates.</p> : notifications.map(n => (
                                <div key={n.id} style={{padding:"10px", borderBottom:"1px solid #f0f0f0", fontSize:"14px", background: n.isSeenByOwner ? "white" : "#e3f2fd"}}>{n.text}</div>
                            ))}
                        </div>
                        <button onClick={() => setShowNotifDropdown(false)} style={{width:"100%", marginTop:"10px", padding:"8px", background:"#f5f5f5", border:"none", borderRadius:"6px"}}>Close</button>
                    </div>
                )}
            </div>
            <button onClick={() => { setActiveTab("profile"); setShowNotifDropdown(false); }} style={{ background: activeTab === "profile" ? "#e3f2fd" : "none", border: "none", fontSize: "24px", cursor: "pointer", borderRadius: "50%", padding: "5px" }} title="My Profile">👤</button>
            <button onClick={handleLogout} className="action-btn" style={{background: "#ffebee", color: "#d32f2f"}}>Logout</button>
        </div>
      </nav>

      {/* --- 2. MAIN CONTENT AREA --- */}
      <main className="main-content" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "20px", maxWidth: "1200px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        
        {/* --- Tab Grid --- */}
        <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(3, 1fr)", 
            gap: "20px", 
            marginBottom: "20px", 
            flexShrink: 0 
        }}>
          <button style={getTabStyle("pets")} onClick={() => setActiveTab("pets")}>🐶 My Pets</button>
          <button style={getTabStyle("appointments")} onClick={() => setActiveTab("appointments")}>📅 Appointments</button>
          <button style={getTabStyle("chat")} onClick={() => setActiveTab("chat")}>💬 Message Clinic {incomingMsgCount > 0 && <span style={{background:"red", color:"white", borderRadius:"50%", padding:"2px 8px", fontSize:"12px"}}>{incomingMsgCount}</span>}</button>
        </div>

        {/* --- 3. DYNAMIC CONTENT WRAPPER --- */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

            {activeTab === "profile" && (
                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "30px", alignItems: "center", paddingRight: "10px" }}>
                    <div className="card" style={{ width: "100%", maxWidth: "800px", borderTop: "5px solid #2196F3" }}>
                        <h3 style={{marginTop:0, borderBottom:"1px solid #eee", paddingBottom:"10px"}}>👤 Owner Information</h3>
                        <form onSubmit={handleSaveProfile} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                            <div>
                                <label style={{ fontSize: "12px", fontWeight: "bold", color:"#555" }}>First Name</label>
                                <input type="text" value={profileData.firstName} onChange={(e) => setProfileData({...profileData, firstName: e.target.value})} required style={{width:"100%", padding:"10px", marginTop:"5px", border:"1px solid #ccc", borderRadius:"5px"}} />
                            </div>
                            <div>
                                <label style={{ fontSize: "12px", fontWeight: "bold", color:"#555" }}>Last Name</label>
                                <input type="text" value={profileData.lastName} onChange={(e) => setProfileData({...profileData, lastName: e.target.value})} required style={{width:"100%", padding:"10px", marginTop:"5px", border:"1px solid #ccc", borderRadius:"5px"}} />
                            </div>
                            <div>
                                <label style={{ fontSize: "12px", fontWeight: "bold", color:"#555" }}>Email Address</label>
                                <input type="email" value={profileData.email || user.email || ""} readOnly disabled title="Email cannot be changed here." style={{width:"100%", padding:"10px", marginTop:"5px", border:"1px solid #ccc", borderRadius:"5px", background: "#f0f0f0", color: "#666", cursor: "not-allowed"}} />
                            </div>
                            <div>
                                <label style={{ fontSize: "12px", fontWeight: "bold", color:"#555" }}>Phone Number</label>
                                <input type="text" value={profileData.phone} onChange={(e) => setProfileData({...profileData, phone: e.target.value})} style={{width:"100%", padding:"10px", marginTop:"5px", border:"1px solid #ccc", borderRadius:"5px"}} />
                            </div>
                            <div style={{ gridColumn: "1 / -1" }}>
                                <label style={{ fontSize: "12px", fontWeight: "bold", color:"#555" }}>Address</label>
                                <input type="text" value={profileData.address} onChange={(e) => setProfileData({...profileData, address: e.target.value})} style={{width:"100%", padding:"10px", marginTop:"5px", border:"1px solid #ccc", borderRadius:"5px"}} />
                            </div>
                            <div style={{ gridColumn: "1 / -1", marginTop: "10px" }}><button type="submit" className="action-btn" style={{ background: "#2196F3", color: "white", width: "100%", padding: "12px" }}>💾 Save Owner Details</button></div>
                        </form>
                    </div>
                </div>
            )}

            {activeTab === "pets" && (
                <div style={{ flex: 1, overflow: "hidden", display: "flex", justifyContent: "center" }}>
                    <div className="card" style={{ width: "100%", maxWidth: "800px", height: "100%", display: "flex", flexDirection: "column", padding: "20px", boxSizing: "border-box" }}>
                        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"15px", flexShrink: 0}}>
                            <h3 style={{margin:0}}>My Pets</h3>
                            <button onClick={openAddPetModal} style={{background:"#4CAF50", color:"white", border:"none", borderRadius:"30px", padding:"10px 25px", cursor:"pointer", fontWeight: "bold", boxShadow: "0 4px 6px rgba(0,0,0,0.1)"}}>+ Add New Pet</button>
                        </div>
                        <input type="text" placeholder="🔍 Pet Search" value={petSearch} onChange={(e) => setPetSearch(e.target.value)} style={{ marginBottom: "15px", borderRadius: "20px", padding: "10px 15px", border: "1px solid #ddd", width: "95%", flexShrink: 0 }} />
                        <div style={{ flex: 1, overflowY: "auto", paddingRight: "5px" }}>
                            {filteredPets.length === 0 ? <p style={{color:"#888", textAlign:"center", padding:"20px"}}>No pets found.</p> : filteredPets.map(pet => (
                                <div key={pet.id} style={{padding:"15px", borderBottom:"1px solid #eee", background: pet.deletionStatus === 'Pending' ? '#ffebee' : '#fff', position: "relative", borderRadius:"8px", marginBottom:"5px", border: "1px solid #f0f0f0"}}>
                                    <div style={{fontSize:"18px"}}><span style={{marginRight:"10px", fontSize:"24px"}}>{['Dog','Cat'].includes(pet.species) ? (pet.species==='Dog'?'🐕':'🐈') : '🐾'}</span><strong>{pet.name}</strong></div>
                                    <div style={{color:"#555", marginLeft:"34px"}}>{pet.species} - {pet.breed} ({pet.age} {pet.ageUnit || "Years"})</div>
                                    {pet.medicalHistory && <div style={{marginLeft: "34px", marginTop: "5px", color: "#555", fontSize: "12px", fontStyle:"italic"}}><strong>Prev. History:</strong> {pet.medicalHistory}</div>}
                                    {pet.deletionStatus === 'Pending' ? (
                                        <div style={{marginLeft: "34px", marginTop: "5px", color: "red", fontWeight: "bold", fontSize: "12px"}}>Deletion Pending Approval</div>
                                    ) : (
                                        <div style={{position: "absolute", top: "15px", right: "15px", display:"flex", gap:"10px"}}>
                                            <button onClick={() => handleViewHistory(pet)} style={{background:"none", border:"none", cursor:"pointer", fontSize:"18px"}} title="View Medical History">📜</button>
                                            <button onClick={() => openEditPetModal(pet)} style={{background:"none", border:"none", cursor:"pointer", fontSize:"18px"}} title="Edit Pet">✏️</button>
                                            <button onClick={() => handleRequestDelete(pet.id, pet.name)} style={{background:"none", border:"none", cursor:"pointer", fontSize:"18px", opacity: 0.6}} title="Request Delete">🗑️</button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* --- APPOINTMENTS TAB --- */}
            {activeTab === "appointments" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", height: "100%", overflow: "hidden" }}>
                    
                    {/* LEFT SIDE: Request Appointment */}
                    <div className="card" style={{ display: "flex", flexDirection: "column", height: "100%", overflowY: "auto", padding: "20px", boxSizing: "border-box" }}>
                        <h3 style={{marginTop:0}}>Request Appointment</h3>
                        <form onSubmit={handleBookAppointment}>
                            <label style={{fontSize:"12px", fontWeight:"bold", color:"#555"}}>Select Pet:</label>
                            <select value={selectedPetId} onChange={e => setSelectedPetId(e.target.value)} style={{width:"100%", padding:"8px", marginBottom:"10px"}}><option value="">-- Choose --</option>{myPets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                            <label style={{fontSize:"12px", fontWeight:"bold", color:"#555", marginTop:"10px", display:"block"}}>Select Date:</label>
                            <div style={{margin:"10px 0"}}><Calendar onChange={setApptDate} value={apptDate} minDate={new Date()} className="custom-calendar" tileDisabled={({ date }) => date.getDay() === 6} /><div style={{fontSize:"11px", color:"red", marginTop:"5px", textAlign:"center"}}>* Clinic is closed on Saturdays</div></div>
                            <label style={{fontSize:"12px", fontWeight:"bold", color:"#555"}}>Select Time:</label>
                            <input type="time" value={apptTime} onChange={e => setApptTime(e.target.value)} required style={{width:"100%", padding:"8px"}} />
                            <button type="submit" className="action-btn" style={{background:"#2196F3", color:"white", width:"100%", marginTop:"10px", padding:"10px"}}>Request Schedule</button>
                        </form>
                    </div>

                    {/* RIGHT SIDE: My Appointments */}
                    <div className="card" style={{ display: "flex", flexDirection: "column", height: "100%", padding: "20px", boxSizing: "border-box" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px", borderBottom: "1px solid #eee", paddingBottom: "10px", flexShrink: 0 }}>
                            <h4 style={{margin:0}}>My Appointments</h4>
                            <select value={apptFilter} onChange={(e) => setApptFilter(e.target.value)} style={{padding: "8px", borderRadius: "5px", border: "1px solid #ccc", outline: "none", cursor: "pointer"}}>
                                <option value="Pending">Pending</option>
                                <option value="Approved">Approved</option>
                                <option value="Done">Completed</option>
                                <option value="Cancelled">Cancelled</option>
                            </select>
                        </div>
                        <div style={{ flex: 1, overflowY: "auto" }}>
                            {filteredAppointments.length === 0 ? <p style={{color: "#999", textAlign: "center", padding: "20px"}}>No {apptFilter} appointments.</p> : (
                                filteredAppointments.map(appt => (
                                    <div key={appt.id} style={{padding: "15px", marginBottom: "10px", border: "1px solid #eee", borderRadius: "8px", background: "#f9f9f9", borderLeft: appt.status === "Done" ? "5px solid #2196F3" : (appt.status === "Approved" ? "5px solid green" : (appt.status === "Cancelled" ? "5px solid red" : "5px solid orange")), position: "relative"}}>
                                        <div style={{ display: "flex", justifyContent: "space-between" }}><strong>{appt.petName}</strong><span style={{ fontSize: "12px", color: "#666" }}>{appt.date} @ {appt.time}</span></div>
                                        <div style={{ fontSize: "14px", color: "#555", margin: "5px 0" }}>
                                            <span style={{fontWeight:"bold", fontSize:"12px", padding:"2px 8px", borderRadius:"10px", color:"white", background: appt.status === "Done" ? "#2196F3" : (appt.status === "Approved" ? "green" : (appt.status === "Cancelled" ? "red" : "orange"))}}>{appt.status}</span>
                                            <span style={{marginLeft:"10px"}}>Reason: {appt.reason}</span>
                                        </div>
                                        {appt.status === "Cancelled" && appt.cancellationReason && (<div style={{fontSize:"12px", color:"red", marginTop:"5px"}}><strong>Cancellation Reason:</strong> {appt.cancellationReason}</div>)}
                                        {(appt.status === "Approved" || appt.status === "Pending") && (
                                            <div style={{display:"flex", gap:"10px", marginTop:"10px"}}>
                                                <button onClick={() => handleCancelAppointment(appt.id)} style={{background:"#ffebee", color:"red", border:"1px solid red", borderRadius:"20px", padding:"5px 15px", cursor:"pointer", fontSize:"12px", fontWeight:"bold"}}>✖ Cancel</button>
                                                <button onClick={() => openRescheduleModal(appt)} style={{background:"#e3f2fd", color:"#1565C0", border:"1px solid #1565C0", borderRadius:"20px", padding:"5px 15px", cursor:"pointer", fontSize:"12px", fontWeight:"bold"}}>📅 Reschedule</button>
                                            </div>
                                        )}
                                        {appt.status === "Done" && (
                                            <button onClick={() => handleViewMedicalRecord(appt)} style={{marginTop: "10px", background: "#E3F2FD", color: "#2196F3", border: "1px solid #2196F3", borderRadius: "20px", padding: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "bold", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "5px"}}>
                                                📄 View Medical Record
                                            </button>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
            
            {/* --- CHAT TAB --- */}
            {activeTab === "chat" && (
                <div style={{ flex: 1, overflow: "hidden", display: "flex", justifyContent: "center" }}>
                    <div className="card" style={{ height: "100%", width: "100%", maxWidth: "800px", display:"flex", flexDirection:"column", padding: "0", boxSizing: "border-box" }}>
                        <div style={{padding:"20px", borderBottom:"1px solid #eee", background:"#f8f9fa", borderRadius:"12px 12px 0 0", flexShrink: 0}}><h3 style={{margin:0}}>💬 Chat with Clinic Staff</h3></div>
                        <div className="chat-messages" style={{flex: 1, overflowY: "auto", padding: "25px"}}>
                            {chatMessages.map(msg => {
                                 const dateObj = msg.createdAt?.toDate ? msg.createdAt.toDate() : new Date(msg.createdAt);
                                 const timeString = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                 return (
                                     <div key={msg.id} className={`chat-bubble ${msg.senderId === user.uid ? "bubble-me" : "bubble-other"}`} style={{position:"relative"}}>
                                        {msg.text}
                                        {msg.isEdited && <span style={{fontSize:"10px", fontStyle:"italic", marginLeft:"5px", opacity: 0.7}}>(edited)</span>}
                                        <div style={{fontSize:"10px", marginTop:"5px", textAlign:"right", opacity:0.7}}>{timeString}</div>
                                        {msg.senderId === user.uid && (
                                            <div onClick={() => handleStartEdit(msg)} style={{position:"absolute", top:"-5px", right:"-5px", background:"#ddd", borderRadius:"50%", width:"15px", height:"15px", fontSize:"10px", textAlign:"center", cursor:"pointer", color:"black"}}>✎</div>
                                        )}
                                     </div>
                                 );
                            })}
                            <div ref={scrollRef}></div>
                        </div>
                        <form onSubmit={handleSendMessage} style={{display:"flex", gap:"10px", padding:"20px", background:"white", borderRadius:"0 0 12px 12px", borderTop:"1px solid #eee", flexShrink: 0}}>
                            {editingMessageId && <button type="button" onClick={handleCancelEdit} style={{background: "#ccc", border: "none", borderRadius: "50%", width: "30px", height: "30px", cursor: "pointer", fontWeight: "bold"}}>✖</button>}
                            <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Type a message..." style={{borderRadius:"30px"}} />
                            <button type="submit" className="action-btn" style={{background: editingMessageId ? "#FF9800" : "#2196F3", color:"white", borderRadius:"30px", padding:"10px 25px"}}>{editingMessageId ? "Update" : "Send"}</button>
                        </form>
                    </div>
                </div>
            )}
        </div>

        {/* --- MODALS --- */}
        {showPetModal && (
            <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 }}>
                <div style={{ background: "white", padding: "30px", borderRadius: "15px", width: "400px", maxHeight:"90vh", overflowY:"auto", boxShadow: "0 10px 30px rgba(0,0,0,0.2)" }}>
                    <h3 style={{ marginTop: 0, borderBottom: "1px solid #eee", paddingBottom: "10px" }}>{isEditingPet ? "Edit Pet" : "Add New Pet"}</h3>
                    <form onSubmit={handlePetSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <input type="text" placeholder="Pet Name" value={petName} onChange={e => setPetName(e.target.value)} required />
                        <select value={species} onChange={e => { setSpecies(e.target.value); setBreed(""); setOtherBreed(""); }}><option>Dog</option><option>Cat</option><option>Other</option></select>
                        {species === "Other" && <input type="text" placeholder="Please specify species..." value={otherSpecies} onChange={e => setOtherSpecies(e.target.value)} required style={{background: "#f9f9f9", border: "1px solid #2196F3"}} />}
                        {["Dog", "Cat"].includes(species) ? (
                            <select value={breed} onChange={e => setBreed(e.target.value)}><option value="">-- Select Breed --</option>{(species === "Dog" ? DOG_BREEDS : CAT_BREEDS).map(b => <option key={b} value={b}>{b}</option>)}</select>
                        ) : (<input type="text" placeholder="Breed (Optional)" value={breed} onChange={e => setBreed(e.target.value)} />)}
                        {breed === "Other" && <input type="text" placeholder="Specify Breed..." value={otherBreed} onChange={e => setOtherBreed(e.target.value)} required style={{background: "#f9f9f9", border: "1px solid #2196F3"}} />}
                        <div style={{display:"flex", gap:"10px"}}><input type="number" placeholder="Age" value={age} onChange={e => setAge(e.target.value)} required style={{flex: 1}} /><select value={ageUnit} onChange={e => setAgeUnit(e.target.value)} style={{flex: 1}}><option value="Years">Years</option><option value="Months">Months</option></select></div>
                        <select value={gender} onChange={e => setGender(e.target.value)}><option>Male</option><option>Female</option></select>
                        <label style={{fontSize:"12px", fontWeight:"bold", color:"#555"}}>Medical History (from other clinics):</label>
                        <textarea rows="3" placeholder="e.g. Vaccinated for Rabies last year..." value={medicalHistory} onChange={e => setMedicalHistory(e.target.value)} style={{width: "100%", padding:"8px", borderRadius:"5px", border:"1px solid #ccc", fontFamily:"inherit"}} />
                        <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}><button type="submit" className="action-btn" style={{ background: "#4CAF50", color: "white", flex: 1 }}>{isEditingPet ? "Save Changes" : "Add Pet"}</button><button type="button" onClick={() => setShowPetModal(false)} className="action-btn" style={{ background: "#ccc", color: "black", flex: 1 }}>Cancel</button></div>
                    </form>
                </div>
            </div>
        )}

        {showRescheduleModal && (
            <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 }}>
                <div style={{ background: "white", padding: "30px", borderRadius: "15px", width: "350px", boxShadow: "0 10px 30px rgba(0,0,0,0.2)" }}>
                    <h3 style={{ marginTop: 0, borderBottom: "1px solid #eee", paddingBottom: "10px" }}>📅 Reschedule Appointment</h3>
                    <form onSubmit={handleRescheduleSubmit}>
                        <div style={{margin:"15px 0"}}>
                            <label style={{fontSize:"12px", fontWeight:"bold", color:"#555", display:"block", marginBottom:"5px"}}>Select New Date:</label>
                            <Calendar 
                                onChange={(date) => setRescheduleData({...rescheduleData, date})} 
                                value={rescheduleData.date} 
                                minDate={new Date()} 
                                className="custom-calendar" 
                                tileDisabled={({ date }) => date.getDay() === 6}
                            />
                            <div style={{fontSize:"11px", color:"red", marginTop:"5px", textAlign:"center"}}>* Clinic is closed on Saturdays</div>
                        </div>
                        <div style={{margin:"15px 0"}}>
                            <label style={{fontSize:"12px", fontWeight:"bold", color:"#555", display:"block", marginBottom:"5px"}}>Select New Time:</label>
                            <input type="time" value={rescheduleData.time} onChange={(e) => setRescheduleData({...rescheduleData, time: e.target.value})} required style={{width:"100%", padding:"8px", borderRadius:"5px", border:"1px solid #ccc"}} />
                        </div>
                        <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                            <button type="submit" className="action-btn" style={{ background: "#2196F3", color: "white", flex: 1 }}>Confirm Reschedule</button>
                            <button type="button" onClick={() => setShowRescheduleModal(false)} className="action-btn" style={{ background: "#ccc", color: "black", flex: 1 }}>Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {/* --- SINGLE APPT MEDICAL RECORD MODAL --- */}
        {showMedicalModal && selectedRecord && (
            <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 }}>
                <div style={{ background: "white", padding: "30px", borderRadius: "15px", width: "400px", boxShadow: "0 10px 30px rgba(0,0,0,0.2)" }}>
                    <h3 style={{ marginTop: 0, borderBottom: "1px solid #eee", paddingBottom: "10px", color: "#2196F3", display: "flex", alignItems: "center", gap: "10px" }}>📝 Medical Record</h3>
                    <div style={{ marginBottom: "20px", color: "#444", fontSize: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                        <div style={{paddingBottom: "10px", borderBottom: "1px solid #f0f0f0"}}>
                            <p style={{margin: "5px 0"}}><strong>Date of Visit:</strong> {selectedRecord.date} @ {selectedRecord.time}</p>
                            <p style={{margin: "5px 0"}}><strong>Reason for Visit:</strong> {selectedRecord.reason || "N/A"}</p>
                        </div>
                        <div>
                            <p style={{margin: "0 0 5px 0", color: "#2196F3", fontWeight: "bold"}}>Symptoms:</p>
                            <div style={{background: "#f9f9f9", padding: "8px", borderRadius: "5px", border: "1px solid #eee"}}>{selectedRecord.symptoms || "N/A"}</div>
                        </div>
                        <div>
                            <p style={{margin: "0 0 5px 0", color: "#2196F3", fontWeight: "bold"}}>Diagnosis:</p>
                            <div style={{background: "#f9f9f9", padding: "8px", borderRadius: "5px", border: "1px solid #eee"}}>{selectedRecord.diagnosis || "N/A"}</div>
                        </div>
                        <div>
                            <p style={{margin: "0 0 5px 0", color: "#2196F3", fontWeight: "bold"}}>Medications Prescribed:</p>
                            <div style={{background: "#f9f9f9", padding: "8px", borderRadius: "5px", border: "1px solid #eee"}}>{selectedRecord.medicine || "N/A"}</div>
                        </div>
                        <div>
                            <p style={{margin: "0 0 5px 0", color: "#2196F3", fontWeight: "bold"}}>Notes:</p>
                            <div style={{background: "#f9f9f9", padding: "8px", borderRadius: "5px", border: "1px solid #eee", fontStyle: "italic"}}>{selectedRecord.notes || "N/A"}</div>
                        </div>
                    </div>
                    <button onClick={() => setShowMedicalModal(false)} className="action-btn" style={{ background: "#2196F3", color: "white", width: "100%", padding: "12px" }}>Close Record</button>
                </div>
            </div>
        )}

        {/* --- NEW PET HISTORY MODAL (LIST) --- */}
        {showHistoryModal && historyPet && (
            <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 }}>
                <div style={{ background: "white", padding: "25px", borderRadius: "15px", width: "500px", maxHeight: "80vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 10px 30px rgba(0,0,0,0.2)" }}>
                    <div style={{borderBottom: "1px solid #eee", paddingBottom: "15px", marginBottom: "15px", display: "flex", justifyContent: "space-between", alignItems: "center"}}>
                        <h3 style={{ margin: 0, color: "#2196F3" }}>📜 Medical History: {historyPet.name}</h3>
                        <button onClick={() => setShowHistoryModal(false)} style={{background:"none", border:"none", fontSize:"20px", cursor:"pointer", color:"#999"}}>✖</button>
                    </div>
                    
                    <div style={{ flex: 1, overflowY: "auto", paddingRight: "10px" }}>
                        {myAppointments.filter(a => a.petId === historyPet.id && a.status === "Done").length === 0 ? (
                            <div style={{textAlign: "center", padding: "30px", color: "#999", fontStyle: "italic"}}>
                                No completed check-up records found for {historyPet.name}.
                            </div>
                        ) : (
                            myAppointments
                                .filter(a => a.petId === historyPet.id && a.status === "Done")
                                .sort((a, b) => new Date(b.date) - new Date(a.date)) // Sort descending by date
                                .map(record => (
                                    <div key={record.id} style={{background: "#f9f9f9", borderRadius: "8px", padding: "15px", marginBottom: "15px", border: "1px solid #eee", boxShadow: "0 2px 4px rgba(0,0,0,0.02)"}}>
                                        <div style={{display: "flex", justifyContent: "space-between", marginBottom: "10px", borderBottom: "1px solid #e0e0e0", paddingBottom: "8px"}}>
                                            <span style={{fontWeight: "bold", color: "#444"}}>📅 {record.date}</span>
                                            <span style={{fontSize: "12px", color: "#777"}}>{record.time}</span>
                                        </div>
                                        <div style={{fontSize: "14px", color: "#555", display: "flex", flexDirection: "column", gap: "5px"}}>
                                            <div><strong>Reason for Visit:</strong> {record.reason || "N/A"}</div>
                                            <div><strong>Symptoms:</strong> {record.symptoms || "N/A"}</div>
                                            <div><strong>🩺 Diagnosis:</strong> {record.diagnosis || "N/A"}</div>
                                            <div><strong>💊 Medications Prescribed:</strong> {record.medicine || "N/A"}</div>
                                            <div><strong>📝 Notes:</strong> {record.notes || "N/A"}</div>
                                        </div>
                                    </div>
                                ))
                        )}
                    </div>

                    <div style={{marginTop: "15px", paddingTop: "15px", borderTop: "1px solid #eee"}}>
                        <button onClick={() => setShowHistoryModal(false)} className="action-btn" style={{ background: "#ccc", color: "#333", width: "100%", padding: "10px" }}>Close History</button>
                    </div>
                </div>
            </div>
        )}

      </main>
    </div>
  );
};

export default OwnerDashboard;
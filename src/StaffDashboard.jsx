import { useEffect, useState, useRef } from "react";
import { auth, db } from "./firebase";
import { signOut } from "firebase/auth";
import { collection, query, onSnapshot, doc, updateDoc, addDoc, deleteDoc, getDocs, where, orderBy } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import logoImg from "./assets/logo.png"; 

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

// --- INVENTORY CONSTANTS ---
const INVENTORY_CATEGORIES = ["Vaccines", "Medicines / Drugs", "Medical Supplies"];
const INVENTORY_UNITS = ["pcs", "vials", "boxes", "bottles", "packs", "ml", "mg"];

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

  // --- AUTOMATIC REPORT STATES ---
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");
  
  // Stats Containers
  const [generatedStats, setGeneratedStats] = useState({
      itemsAdded: 0,
      itemsUsed: 0,
      totalAppointments: 0,
      completedAppointments: 0,
      cancelledAppointments: 0,
      // Store lists for details
      addedLogs: [],
      usedLogs: [],
      rangeApps: []
  });
  const [serviceBreakdown, setServiceBreakdown] = useState({});
  const [lowStockItems, setLowStockItems] = useState([]);
  const [expiredItems, setExpiredItems] = useState([]);
  
  // Report Detail Modal State
  const [reportDetailModal, setReportDetailModal] = useState(null); 

  // --- INVENTORY STATES ---
  const [inventory, setInventory] = useState([]);
  const [inventoryLogs, setInventoryLogs] = useState([]);
  const [inventorySearch, setInventorySearch] = useState("");
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [editingInventoryId, setEditingInventoryId] = useState(null); 
  const [inventoryData, setInventoryData] = useState({
      name: "", category: "", quantity: 0, unit: "pcs", expiryDate: "", threshold: 5});

  // --- DATA FETCHING ---
  useEffect(() => {
    const unsubAppts = onSnapshot(query(collection(db, "appointments"), orderBy("date", "desc")), (snap) => 
        setAppointments(snap.docs.map(doc => ({ ...doc.data(), id: doc.id })))
    );

    const unsubChat = onSnapshot(query(collection(db, "messages"), orderBy("createdAt", "asc")), (snap) => {
        setAllMessages(snap.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });

    const unsubInventory = onSnapshot(query(collection(db, "inventory"), orderBy("name", "asc")), (snap) => {
        setInventory(snap.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });

    const unsubLogs = onSnapshot(query(collection(db, "inventoryLogs"), orderBy("timestamp", "desc")), (snap) => {
        setInventoryLogs(snap.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });

    const fetchBasicData = async () => {
        const petSnap = await getDocs(collection(db, "pets"));
        setAllPets(petSnap.docs.map(doc => ({ ...doc.data(), id: doc.id })));
        
        const userSnap = await getDocs(query(collection(db, "users"), where("role", "==", "owner")));
        setOwners(userSnap.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    };
    fetchBasicData();

    return () => { unsubAppts(); unsubChat(); unsubInventory(); unsubLogs(); };
  }, []);

  // --- AUTO-MARK AS READ LOGIC ---
  useEffect(() => {
    if (activeTab === "messages" && selectedChatOwner) {
        const unreadMsgs = allMessages.filter(
            m => m.senderId === selectedChatOwner.id && !m.read && m.senderId !== "AI_BOT"
        );
        
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

  // --- AUTOMATIC REPORT GENERATION LOGIC ---
  useEffect(() => {
      // Calculate Low Stock and Expired 
      const lowStock = inventory.filter(i => i.quantity <= (i.threshold || 5));
      const today = new Date();
      today.setHours(0,0,0,0);
      const expired = inventory.filter(i => i.expiryDate && new Date(i.expiryDate) < today);
      
      setLowStockItems(lowStock);
      setExpiredItems(expired);

      if (reportStartDate && reportEndDate) {
          const start = new Date(reportStartDate);
          const end = new Date(reportEndDate);
          end.setHours(23, 59, 59, 999);

          // 1. Calculate Inventory Stats from Logs
          let added = 0;
          let used = 0;
          const addedLogs = [];
          const usedLogs = [];

          inventoryLogs.forEach(log => {
              const logDate = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
              if (logDate >= start && logDate <= end) {
                  if (log.change > 0) {
                      added += log.change;
                      addedLogs.push({ ...log, date: logDate });
                  } else if (log.change < 0) {
                      used += Math.abs(log.change);
                      usedLogs.push({ ...log, date: logDate, qty: Math.abs(log.change) });
                  }
              }
          });

          // 2. Calculate Appointment Stats
          const rangeApps = appointments.filter(app => {
              const appDate = new Date(app.date);
              return appDate >= start && appDate <= end;
          });
          
          const completed = rangeApps.filter(a => a.status === 'Done');
          const cancelled = rangeApps.filter(a => a.status === 'Cancelled');
          
          // Service Breakdown
          const breakdown = {};
          rangeApps.forEach(app => {
              const type = app.reason || "Other";
              if (breakdown[type]) breakdown[type]++;
              else breakdown[type] = 1;
          });

          setGeneratedStats({
              itemsAdded: added,
              itemsUsed: used,
              totalAppointments: rangeApps.length,
              completedAppointments: completed.length,
              cancelledAppointments: cancelled.length,
              addedLogs,
              usedLogs,
              rangeApps
          });
          setServiceBreakdown(breakdown);
      }
  }, [reportStartDate, reportEndDate, inventoryLogs, appointments, inventory]);


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

  const getUnreadCount = (ownerId) => allMessages.filter(m => m.senderId === ownerId && !m.read && m.senderId !== "AI_BOT").length;
  
  const totalUnreadMessages = allMessages.filter(m => m.senderId !== auth.currentUser?.uid && !m.read && m.senderId !== "AI_BOT").length;

  // --- INVENTORY HELPERS ---
  const getStockStatus = (item) => {
      if (item.quantity <= 0) return { label: "Out of Stock", color: "#f44336" };
      if (item.quantity <= item.threshold) return { label: "Low Stock", color: "#ff9800" };
      return { label: "In Stock", color: "#4CAF50" };
  };

  // --- PRINT REPORTS ---
  const printInventoryReport = () => {
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
          <html>
              <head><title>Inventory Report</title></head>
              <body style="font-family: sans-serif; padding: 20px;">
                  <h2>PawPals Clinic Inventory Report</h2>
                  <p>Date: ${new Date().toLocaleString()}</p>
                  <table border="1" style="width:100%; border-collapse: collapse; text-align: left;">
                      <thead>
                          <tr style="background: #f1f1f1;">
                              <th style="padding: 10px;">Item Name</th>
                              <th>Category</th>
                              <th>Quantity</th>
                              <th>Expiry Date</th>
                              <th>Status</th>
                          </tr>
                      </thead>
                      <tbody>
                          ${inventory.map(item => `
                              <tr>
                                  <td style="padding: 10px;">${item.name}</td>
                                  <td>${item.category}</td>
                                  <td>${item.quantity} ${item.unit}</td>
                                  <td>${item.expiryDate || "N/A"}</td>
                                  <td>${getStockStatus(item).label}</td>
                              </tr>
                          `).join('')}
                      </tbody>
                  </table>
              </body>
          </html>
      `);
      printWindow.document.close();
      printWindow.print();
  };
  
  const printSummaryReport = () => {
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
          <html>
              <head><title>Summary Report</title></head>
              <body style="font-family: sans-serif; padding: 20px;">
                  <h2 style="color: #2196F3;">PawPals Clinic - Period Summary Report</h2>
                  <p><strong>Period:</strong> ${reportStartDate} to ${reportEndDate}</p>
                  <hr/>
                  <div style="display: flex; gap: 20px; margin-top: 20px;">
                      <div style="flex: 1; border: 1px solid #ddd; padding: 15px; border-radius: 8px;">
                          <h3>Inventory Activity</h3>
                          <p>Items Received / Added: <strong>${generatedStats.itemsAdded}</strong></p>
                          <p>Items Used / Issued: <strong>${generatedStats.itemsUsed}</strong></p>
                          <p>Low Stock Alerts: <strong>${lowStockItems.length}</strong></p>
                          <p>Expired Items: <strong>${expiredItems.length}</strong></p>
                      </div>
                      <div style="flex: 1; border: 1px solid #ddd; padding: 15px; border-radius: 8px;">
                          <h3>Appointments</h3>
                          <p>Total Scheduled: <strong>${generatedStats.totalAppointments}</strong></p>
                          <p>Completed: <strong>${generatedStats.completedAppointments}</strong></p>
                          <p>Cancelled / Missed: <strong>${generatedStats.cancelledAppointments}</strong></p>
                          <h4>Service Types Breakdown:</h4>
                          <ul>
                            ${Object.entries(serviceBreakdown).map(([key, val]) => `<li>${key}: ${val}</li>`).join('')}
                          </ul>
                      </div>
                  </div>
              </body>
          </html>
      `);
      printWindow.document.close();
      printWindow.print();
  };

  // --- ACTIONS ---
  const handleStatusUpdate = async (id, newStatus) => { await updateDoc(doc(db, "appointments", id), { status: newStatus, staffId: auth.currentUser.uid }); };
  
  // --- INVENTORY ACTIONS (UPDATED) ---
  const handleOpenAddInventory = () => {
      setEditingInventoryId(null);
      setInventoryData({ name: "", category: "", quantity: 0, unit: "pcs", expiryDate: "", threshold: 5 });
      setShowInventoryModal(true);
  };

  const handleOpenEditInventory = (item) => {
      setEditingInventoryId(item.id);
      setInventoryData({ 
          name: item.name, 
          category: item.category, 
          quantity: item.quantity, 
          unit: item.unit, 
          expiryDate: item.expiryDate || "", 
          threshold: item.threshold || 5 
      });
      setShowInventoryModal(true);
  };

  const handleDeleteInventory = async (id) => {
      if(window.confirm("Are you sure you want to delete this item? This cannot be undone.")) {
          try {
              await deleteDoc(doc(db, "inventory", id));
              showToast("Item deleted.", "error");
          } catch (err) {
              console.error(err);
              showToast("Error deleting item.", "error");
          }
      }
  };

  const handleQuickUsage = async (item) => {
      const qtyStr = prompt(`How many ${item.unit} of ${item.name} were used/issued?`, "1");
      if (!qtyStr) return;
      const qty = parseInt(qtyStr);
      if (isNaN(qty) || qty <= 0) return showToast("Invalid quantity", "error");
      
      if (item.quantity < qty) return showToast("Not enough stock available", "error");

      try {
          await updateDoc(doc(db, "inventory", item.id), {
              quantity: item.quantity - qty,
              lastUpdated: new Date()
          });
          
          await addDoc(collection(db, "inventoryLogs"), {
              itemId: item.id,
              itemName: item.name,
              change: -qty, // Negative for usage
              reason: "Quick Usage",
              timestamp: new Date()
          });
          showToast(`Recorded usage of ${qty} ${item.unit}`);
      } catch (err) {
          console.error(err);
          showToast("Error updating stock", "error");
      }
  };

  const handleSaveInventory = async (e) => {
      e.preventDefault();
      try {
          if (editingInventoryId) {
              // Edit Mode
              const oldItem = inventory.find(i => i.id === editingInventoryId);
              const qtyDiff = inventoryData.quantity - oldItem.quantity;
              
              await updateDoc(doc(db, "inventory", editingInventoryId), {
                  ...inventoryData,
                  lastUpdated: new Date()
              });

              if (qtyDiff !== 0) {
                   await addDoc(collection(db, "inventoryLogs"), {
                      itemId: editingInventoryId,
                      itemName: inventoryData.name,
                      change: qtyDiff,
                      reason: "Manual Edit",
                      timestamp: new Date()
                  });
              }
              showToast("Inventory updated successfully!");
          } else {
              // Add Mode
              const docRef = await addDoc(collection(db, "inventory"), {
                  ...inventoryData,
                  createdAt: new Date()
              });
              
              // Log initial stock
              await addDoc(collection(db, "inventoryLogs"), {
                  itemId: docRef.id,
                  itemName: inventoryData.name,
                  change: inventoryData.quantity,
                  reason: "Initial Stock",
                  timestamp: new Date()
              });
              showToast("Item added to inventory!");
          }
          setShowInventoryModal(false);
          setInventoryData({ name: "", category: "", quantity: 0, unit: "pcs", expiryDate: "", threshold: 5 });
          setEditingInventoryId(null);
      } catch (err) {
          console.error(err);
          showToast("Error saving inventory.", "error");
      }
  };

  // --- CALENDAR APP CLICK HANDLER ---
  const handleCalendarApptClick = (appt) => {
      setApptSubTab(appt.status);
      setApptViewMode("list");
  };

  // --- REPORT CLICK HANDLER ---
  const handleReportClick = (type) => {
      let data = [];
      let title = "";
      
      switch(type) {
          case 'added':
              title = "Inventory Items Added";
              data = generatedStats.addedLogs;
              break;
          case 'used':
              title = "Inventory Items Used / Issued";
              data = generatedStats.usedLogs;
              break;
          case 'appointments':
              title = "Scheduled Appointments";
              data = generatedStats.rangeApps;
              break;
          case 'lowstock':
              title = "Current Low Stock Alerts";
              data = lowStockItems;
              break;
          case 'expired':
              title = "Expired Items";
              data = expiredItems;
              break;
          default:
              return;
      }
      setReportDetailModal({ type, title, data });
  };

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
                          <div key={a.id} onClick={() => handleCalendarApptClick(a)} style={{background:a.status==='Pending'?'orange':'green', color:"white", padding:"2px", borderRadius:"3px", fontSize:"10px", overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis", cursor: "pointer"}}>
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
                                      <div key={a.id} onClick={() => handleCalendarApptClick(a)} style={{background: a.status === 'Pending' ? 'orange' : 'green', color: "white", fontSize: "11px", padding: "4px", borderRadius: "4px", marginBottom: "2px", cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.2)"}}>
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
    <div className="dashboard-container" style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f5f5" }}>
      
      {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({...toast, show: false})} />}

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

      <main className="main-content" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "20px", maxWidth: "1200px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        
         <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "20px", marginBottom: "20px", flexShrink: 0 }}>
            <button style={getTabStyle("appointments")} onClick={() => setActiveTab("appointments")}>📅 Appointments</button>
            <button style={getTabStyle("records")} onClick={() => setActiveTab("records")}>📋 Pet Records</button>
            <button style={getTabStyle("messages")} onClick={() => setActiveTab("messages")}>
                💬 Messages
                {totalUnreadMessages > 0 && (
                    <span style={{background:"red", color:"white", borderRadius:"50%", padding:"2px 8px", fontSize:"12px", marginLeft:"5px"}}>
                        {totalUnreadMessages}
                    </span>
                )}
            </button>
            <button style={getTabStyle("inventory")} onClick={() => setActiveTab("inventory")}>📦 Inventory</button>
            <button style={getTabStyle("reports")} onClick={() => setActiveTab("reports")}>📑 Reports</button>
         </div>

         <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
             
             {/* --- APPOINTMENTS TAB --- */}
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
                                 <button onClick={() => setApptSubTab("Pending")} style={{ background: apptSubTab === "Pending" ? "orange" : "#eee", color: apptSubTab === "Pending" ? "white" : "#555", border: "none", padding: "8px 15px", borderRadius: "20px", cursor: "pointer", fontWeight: "bold" }}>Pending</button>
                                 <button onClick={() => setApptSubTab("Approved")} style={{ background: apptSubTab === "Approved" ? "green" : "#eee", color: apptSubTab === "Approved" ? "white" : "#555", border: "none", padding: "8px 15px", borderRadius: "20px", cursor: "pointer", fontWeight: "bold" }}>Approved</button>
                                 <button onClick={() => setApptSubTab("Done")} style={{ background: apptSubTab === "Done" ? "#2196F3" : "#eee", color: apptSubTab === "Done" ? "white" : "#555", border: "none", padding: "8px 15px", borderRadius: "20px", cursor: "pointer", fontWeight: "bold" }}>Completed</button>
                                 <button onClick={() => setApptSubTab("Cancelled")} style={{ background: apptSubTab === "Cancelled" ? "#f44336" : "#eee", color: apptSubTab === "Cancelled" ? "white" : "#555", border: "none", padding: "8px 15px", borderRadius: "20px", cursor: "pointer", fontWeight: "bold" }}>Cancelled</button>
                             </div>
                             <div style={{ flex: 1, overflowY: "auto" }}>
                                 <table className="table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.95rem" }}>
                                     <thead>
                                         <tr style={{ background: "#f8f9fa", textAlign: "left", color: "#666" }}>
                                             <th style={{ padding: "12px", borderBottom: "2px solid #eee" }}>Date & Time</th>
                                             <th style={{ padding: "12px", borderBottom: "2px solid #eee" }}>Pet & Owner</th>
                                             <th style={{ padding: "12px", borderBottom: "2px solid #eee" }}>Reason</th>
                                             <th style={{ padding: "12px", borderBottom: "2px solid #eee" }}>Status</th>
                                             <th style={{ padding: "12px", borderBottom: "2px solid #eee" }}>Actions</th>
                                         </tr>
                                     </thead>
                                     <tbody>
                                         {filteredAppointments.length === 0 ? <tr><td colSpan="5" style={{padding:"20px", textAlign:"center", color:"#888"}}>No appointments found in this category.</td></tr> :
                                             filteredAppointments.map((appt) => {
                                                 const owner = owners.find(o => o.id === appt.ownerId);
                                                 return (
                                                     <tr key={appt.id} style={{ borderBottom: "1px solid #f1f1f1" }}>
                                                         <td style={{ padding: "12px" }}>
                                                             <div style={{ fontWeight: "bold" }}>{appt.date}</div>
                                                             <div style={{ fontSize: "0.85rem", color: "#666" }}>{appt.time}</div>
                                                         </td>
                                                         <td style={{ padding: "12px" }}>
                                                             <div style={{ fontWeight: "bold", color: "#2196F3" }}>{appt.petName}</div>
                                                             <div style={{ fontSize: "0.85rem", color: "#666" }}>Owner: {owner ? `${owner.firstName} ${owner.lastName}` : "Unknown"}</div>
                                                         </td>
                                                         <td style={{ padding: "12px" }}>{appt.reason}</td>
                                                         <td style={{ padding: "12px" }}>
                                                             <span style={{
                                                                 padding: "4px 10px", borderRadius: "12px", fontSize: "0.8rem", fontWeight: "bold",
                                                                 background: appt.status === "Pending" ? "#fff3e0" : appt.status === "Approved" ? "#e8f5e9" : appt.status === "Done" ? "#e3f2fd" : "#ffebee",
                                                                 color: appt.status === "Pending" ? "orange" : appt.status === "Approved" ? "green" : appt.status === "Done" ? "#2196F3" : "#d32f2f"
                                                             }}>
                                                                 {appt.status}
                                                             </span>
                                                         </td>
                                                         <td style={{ padding: "12px" }}>
                                                             <div style={{ display: "flex", gap: "8px" }}>
                                                                 {appt.status === "Pending" && (
                                                                     <>
                                                                         <button onClick={() => handleStatusUpdate(appt.id, "Approved")} style={{ background: "#4CAF50", color: "white", border: "none", padding: "6px 12px", borderRadius: "4px", cursor: "pointer" }}>Approve</button>
                                                                         <button onClick={() => handleStatusUpdate(appt.id, "Cancelled")} style={{ background: "#f44336", color: "white", border: "none", padding: "6px 12px", borderRadius: "4px", cursor: "pointer" }}>Decline</button>
                                                                     </>
                                                                 )}
                                                                 {appt.status === "Approved" && (
                                                                     <>
                                                                         <button onClick={() => openConsultModal(appt.id)} style={{ background: "#2196F3", color: "white", border: "none", padding: "6px 12px", borderRadius: "4px", cursor: "pointer" }}>Consultation</button>
                                                                         <button onClick={() => handleStatusUpdate(appt.id, "Cancelled")} style={{ background: "#f44336", color: "white", border: "none", padding: "6px 12px", borderRadius: "4px", cursor: "pointer" }}>Cancel</button>
                                                                     </>
                                                                 )}
                                                                 {appt.status === "Done" && <span style={{color:"#888", fontSize:"12px"}}>Completed</span>}
                                                                 {appt.status === "Cancelled" && <span style={{color:"#888", fontSize:"12px"}}>Cancelled</span>}
                                                             </div>
                                                         </td>
                                                     </tr>
                                                 );
                                             })
                                         }
                                     </tbody>
                                 </table>
                             </div>
                         </div>
                     )}
                 </div>
             )}

             {/* --- PET RECORDS TAB (UPDATED WITH PHONE NUMBER) --- */}
             {activeTab === "records" && (
                 <div className="card" style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: "20px", boxSizing: "border-box" }}>
                     <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px"}}>
                         <h3>Pet Records Database</h3>
                         <input type="text" placeholder="Search Pet or Owner Name..." value={petSearch} onChange={(e) => setPetSearch(e.target.value)} style={{padding:"10px", width:"300px", borderRadius:"8px", border:"1px solid #ddd"}} />
                     </div>
                     <div style={{ flex: 1, overflowY: "auto" }}>
                         <table style={{ width: "100%", borderCollapse: "collapse" }}>
                             <thead>
                                 <tr style={{ background: "#f8f9fa", textAlign: "left" }}>
                                     <th style={{ padding: "12px", borderBottom: "2px solid #eee" }}>Pet Name</th>
                                     <th style={{ padding: "12px", borderBottom: "2px solid #eee" }}>Species/Breed</th>
                                     <th style={{ padding: "12px", borderBottom: "2px solid #eee" }}>Owner & Phone</th>
                                     <th style={{ padding: "12px", borderBottom: "2px solid #eee" }}>History</th>
                                 </tr>
                             </thead>
                             <tbody>
                                 {filteredRecords.map(pet => {
                                     const owner = owners.find(o => o.id === pet.ownerId);
                                     return (
                                         <tr key={pet.id} style={{ borderBottom: "1px solid #f1f1f1" }}>
                                             <td style={{ padding: "12px", fontWeight: "bold" }}>{pet.name}</td>
                                             <td style={{ padding: "12px", color: "#666" }}>{pet.species} ({pet.breed})</td>
                                             <td style={{ padding: "12px" }}>
                                                 <div style={{fontWeight:"500"}}>{owner ? `${owner.firstName} ${owner.lastName}` : "Unknown"}</div>
                                                 {/* FIX: Checking phoneNumber specifically */}
                                                 <div style={{fontSize:"12px", color:"#2196F3"}}>📞 {owner ? (owner.phoneNumber || owner.contactNumber || "No Phone") : "N/A"}</div>
                                             </td>
                                             <td style={{ padding: "12px" }}>
                                                 <button onClick={() => setViewingPet(pet)} style={{ background: "#673AB7", color: "white", border: "none", padding: "6px 12px", borderRadius: "4px", cursor: "pointer" }}>View History</button>
                                             </td>
                                         </tr>
                                     );
                                 })}
                             </tbody>
                         </table>
                     </div>
                 </div>
             )}

             {/* --- MESSAGES TAB --- */}
             {activeTab === "messages" && (
                 <div className="card" style={{ width: "100%", height: "100%", display: "flex", overflow: "hidden", padding: 0 }}>
                     <div style={{ width: "300px", borderRight: "1px solid #eee", display: "flex", flexDirection: "column", background: "#f9f9f9" }}>
                         <div style={{ padding: "15px", borderBottom: "1px solid #eee", fontWeight: "bold", background: "white" }}>Conversations</div>
                         <div style={{ flex: 1, overflowY: "auto" }}>
                             {owners.map(owner => {
                                 const unread = getUnreadCount(owner.id);
                                 return (
                                     <div key={owner.id} onClick={() => setSelectedChatOwner(owner)} 
                                          style={{ padding: "15px", cursor: "pointer", background: selectedChatOwner?.id === owner.id ? "#e3f2fd" : "transparent", borderBottom: "1px solid #f1f1f1", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                         <div>
                                             <div style={{ fontWeight: "bold", fontSize: "14px" }}>{owner.firstName} {owner.lastName}</div>
                                             <div style={{ fontSize: "11px", color: "#666" }}>Click to view chat</div>
                                         </div>
                                         {unread > 0 && <span style={{ background: "red", color: "white", borderRadius: "50%", padding: "2px 8px", fontSize: "11px", fontWeight: "bold" }}>{unread}</span>}
                                     </div>
                                 );
                             })}
                         </div>
                     </div>
                     <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "white" }}>
                         {selectedChatOwner ? (
                             <>
                                 <div style={{ padding: "15px", borderBottom: "1px solid #eee", background: "#f8f9fa", fontWeight: "bold", color: "#333" }}>
                                     Chat with {selectedChatOwner.firstName} {selectedChatOwner.lastName}
                                 </div>
                                 <div style={{ flex: 1, padding: "20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
                                     {chatMessages.length === 0 ? <p style={{color:"#888", textAlign:"center", marginTop:"20px"}}>No messages yet.</p> :
                                         chatMessages.map(msg => (
                                             <div key={msg.id} style={{ alignSelf: msg.senderId === auth.currentUser.uid ? "flex-end" : "flex-start", maxWidth: "70%" }}>
                                                 <div style={{ background: msg.senderId === auth.currentUser.uid ? "#2196F3" : "#f1f1f1", color: msg.senderId === auth.currentUser.uid ? "white" : "#333", padding: "10px 15px", borderRadius: "12px", fontSize: "14px", position: "relative" }}>
                                                     {msg.text}
                                                     {msg.isEdited && <span style={{fontSize:"9px", opacity:0.7, marginLeft:"5px"}}>(edited)</span>}
                                                 </div>
                                                 {msg.senderId === auth.currentUser.uid && (
                                                     <div style={{ textAlign: "right", marginTop: "2px" }}>
                                                         <span onClick={() => handleStartEdit(msg)} style={{ fontSize: "10px", color: "#999", cursor: "pointer", marginRight: "5px" }}>Edit</span>
                                                         {msg.read && <span style={{ fontSize: "10px", color: "#4CAF50" }}>Read</span>}
                                                     </div>
                                                 )}
                                             </div>
                                         ))
                                     }
                                     <div ref={scrollRef}></div>
                                 </div>
                                 <form onSubmit={handleSendMessage} style={{ padding: "15px", borderTop: "1px solid #eee", display: "flex", gap: "10px", background: "#f9f9f9" }}>
                                     <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Type a message..." style={{ flex: 1, padding: "12px", borderRadius: "20px", border: "1px solid #ddd", outline: "none" }} />
                                     {editingMessageId && <button type="button" onClick={handleCancelEdit} style={{ background: "#9e9e9e", color: "white", border: "none", padding: "0 15px", borderRadius: "20px", cursor: "pointer" }}>Cancel</button>}
                                     <button type="submit" style={{ background: "#2196F3", color: "white", border: "none", padding: "0 20px", borderRadius: "20px", cursor: "pointer", fontWeight: "bold" }}>{editingMessageId ? "Update" : "Send"}</button>
                                 </form>
                             </>
                         ) : (
                             <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#999" }}>Select a conversation to start chatting</div>
                         )}
                     </div>
                 </div>
             )}

             {/* --- INVENTORY TAB (UPDATED ACTIONS WITH MINUS) --- */}
             {activeTab === "inventory" && (
                 <div className="card" style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: "20px", boxSizing: "border-box", overflowY: "auto" }}>
                     <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexShrink: 0 }}>
                         <h3>Inventory Management</h3>
                         <div style={{display:"flex", gap:"10px"}}>
                            <button onClick={printInventoryReport} style={{background:"#607D8B", color:"white", border:"none", padding:"10px 20px", borderRadius:"8px", cursor:"pointer"}}>Print Report</button>
                            <button onClick={handleOpenAddInventory} style={{background:"#4CAF50", color:"white", border:"none", padding:"10px 20px", borderRadius:"8px", cursor:"pointer", fontWeight:"bold"}}>+ Add Item</button>
                         </div>
                     </div>
                     <input type="text" placeholder="Search Inventory..." value={inventorySearch} onChange={(e) => setInventorySearch(e.target.value)} style={{padding:"10px", width:"100%", maxWidth:"400px", borderRadius:"8px", border:"1px solid #ddd", marginBottom:"20px"}} />
                     
                     <div style={{ flex: 1, overflowY: "auto" }}>
                         <table style={{ width: "100%", borderCollapse: "collapse" }}>
                             <thead style={{position:"sticky", top:0, background:"white", zIndex: 1}}>
                                 <tr style={{ background: "#f8f9fa", textAlign: "left" }}>
                                     <th style={{ padding: "12px", borderBottom: "2px solid #eee" }}>Item Name</th>
                                     <th style={{ padding: "12px", borderBottom: "2px solid #eee" }}>Category</th>
                                     <th style={{ padding: "12px", borderBottom: "2px solid #eee" }}>Stock Level</th>
                                     <th style={{ padding: "12px", borderBottom: "2px solid #eee" }}>Status</th>
                                     <th style={{ padding: "12px", borderBottom: "2px solid #eee" }}>Actions</th>
                                 </tr>
                             </thead>
                             <tbody>
                                 {inventory.filter(i => i.name.toLowerCase().includes(inventorySearch.toLowerCase())).map(item => {
                                     const status = getStockStatus(item);
                                     return (
                                         <tr key={item.id} style={{ borderBottom: "1px solid #f1f1f1" }}>
                                             <td style={{ padding: "12px", fontWeight: "bold" }}>{item.name}</td>
                                             <td style={{ padding: "12px", color: "#666" }}>{item.category}</td>
                                             <td style={{ padding: "12px" }}>
                                                 <span style={{fontSize:"16px", fontWeight:"bold"}}>{item.quantity}</span> <span style={{color:"#777", fontSize:"12px"}}>{item.unit}</span>
                                             </td>
                                             <td style={{ padding: "12px" }}>
                                                 <span style={{color: status.color, fontWeight:"bold", border:`1px solid ${status.color}`, padding:"2px 8px", borderRadius:"12px", fontSize:"11px"}}>{status.label}</span>
                                             </td>
                                             <td style={{ padding: "12px" }}>
                                                 <div style={{display:"flex", gap:"8px"}}>
                                                     {/* MINUS BUTTON ADDED HERE */}
                                                     <button onClick={() => handleQuickUsage(item)} style={{background:"#ffebee", color:"red", border:"1px solid #ffcdd2", borderRadius:"4px", cursor:"pointer", padding:"2px 8px", fontWeight:"bold"}} title="Record Usage (Minus)">-</button>
                                                     
                                                     <button onClick={() => handleOpenEditInventory(item)} style={{background:"none", border:"none", cursor:"pointer", fontSize:"18px"}} title="Edit Item">Edit</button>
                                                     <button onClick={() => handleDeleteInventory(item.id)} style={{background:"none", border:"none", cursor:"pointer", fontSize:"18px"}} title="Delete Item">Delete</button>
                                                 </div>
                                             </td>
                                         </tr>
                                     );
                                 })}
                             </tbody>
                         </table>
                     </div>
                 </div>
             )}

             {/* --- REPORTS TAB (AUTOMATIC & DETAILED) --- */}
             {activeTab === "reports" && (
                 <div className="card" style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: "20px", boxSizing: "border-box", overflowY: "auto" }}>
                     <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexShrink: 0 }}>
                         <h3>Automated Reports</h3>
                         {reportStartDate && reportEndDate && (
                             <button onClick={printSummaryReport} style={{background:"#607D8B", color:"white", border:"none", padding:"10px 20px", borderRadius:"8px", cursor:"pointer"}}>
                                 🖨️ Print Summary
                             </button>
                         )}
                     </div>

                     <div style={{background:"#e3f2fd", padding:"20px", borderRadius:"12px", marginBottom:"30px", border:"1px solid #bbdefb", flexShrink: 0}}>
                         <h4 style={{marginTop:0, color:"#1565C0"}}>1. Select Date Range</h4>
                         <div style={{display:"flex", gap:"20px", alignItems:"center"}}>
                             <div>
                                 <label style={{display:"block", fontSize:"12px", fontWeight:"bold", marginBottom:"5px", color:"#555"}}>Start Date</label>
                                 <input type="date" value={reportStartDate} onChange={(e) => setReportStartDate(e.target.value)} style={{padding:"10px", borderRadius:"8px", border:"1px solid #ccc"}} />
                             </div>
                             <span style={{marginTop:"20px"}}>➔</span>
                             <div>
                                 <label style={{display:"block", fontSize:"12px", fontWeight:"bold", marginBottom:"5px", color:"#555"}}>End Date</label>
                                 <input type="date" value={reportEndDate} onChange={(e) => setReportEndDate(e.target.value)} style={{padding:"10px", borderRadius:"8px", border:"1px solid #ccc"}} />
                             </div>
                         </div>
                     </div>

                     {(!reportStartDate || !reportEndDate) ? (
                         <div style={{textAlign:"center", color:"#999", marginTop:"50px"}}>
                             <div style={{fontSize:"40px", marginBottom:"10px"}}>📅</div>
                             Please select a date range to generate the report automatically.
                         </div>
                     ) : (
                         <div className="fade-in">
                             <h4 style={{color:"#1565C0", marginBottom:"15px"}}>2. Report Summary ({reportStartDate} to {reportEndDate})</h4>
                             
                             <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:"20px"}}>
                                 {/* Inventory Added Card */}
                                 <div onClick={() => handleReportClick('added')} style={{background:"white", border:"1px solid #eee", padding:"20px", borderRadius:"12px", boxShadow:"0 2px 8px rgba(0,0,0,0.05)", textAlign:"center", cursor: "pointer", transition: "transform 0.1s"}}>
                                     <div style={{fontSize:"30px", marginBottom:"10px"}}>📦</div>
                                     <div style={{color:"#777", fontSize:"14px", fontWeight:"bold", textTransform:"uppercase"}}>Items Added</div>
                                     <div style={{fontSize:"36px", fontWeight:"bold", color:"#4CAF50", margin:"10px 0"}}>{generatedStats.itemsAdded}</div>
                                     <div style={{fontSize:"12px", color:"#2196F3", textDecoration:"underline"}}>View Details</div>
                                 </div>

                                 {/* Inventory Used Card */}
                                 <div onClick={() => handleReportClick('used')} style={{background:"white", border:"1px solid #eee", padding:"20px", borderRadius:"12px", boxShadow:"0 2px 8px rgba(0,0,0,0.05)", textAlign:"center", cursor: "pointer", transition: "transform 0.1s"}}>
                                     <div style={{fontSize:"30px", marginBottom:"10px"}}>🧾</div>
                                     <div style={{color:"#777", fontSize:"14px", fontWeight:"bold", textTransform:"uppercase"}}>Items Used</div>
                                     <div style={{fontSize:"36px", fontWeight:"bold", color:"#f44336", margin:"10px 0"}}>{generatedStats.itemsUsed}</div>
                                     <div style={{fontSize:"12px", color:"#2196F3", textDecoration:"underline"}}>View Details</div>
                                 </div>

                                 {/* Appointments Card */}
                                 <div onClick={() => handleReportClick('appointments')} style={{background:"white", border:"1px solid #eee", padding:"20px", borderRadius:"12px", boxShadow:"0 2px 8px rgba(0,0,0,0.05)", textAlign:"center", cursor: "pointer", transition: "transform 0.1s"}}>
                                     <div style={{fontSize:"30px", marginBottom:"10px"}}>🐾</div>
                                     <div style={{color:"#777", fontSize:"14px", fontWeight:"bold", textTransform:"uppercase"}}>Appointments</div>
                                     <div style={{fontSize:"36px", fontWeight:"bold", color:"#2196F3", margin:"10px 0"}}>{generatedStats.totalAppointments}</div>
                                     <div style={{fontSize:"12px", color:"#666"}}>
                                         {generatedStats.completedAppointments} Done / {generatedStats.cancelledAppointments} Cancelled
                                     </div>
                                 </div>
                                 
                                 {/* Low Stock Card */}
                                 <div onClick={() => handleReportClick('lowstock')} style={{background:"#fff3e0", border:"1px solid #ffe0b2", padding:"20px", borderRadius:"12px", boxShadow:"0 2px 8px rgba(0,0,0,0.05)", textAlign:"center", cursor: "pointer"}}>
                                     <div style={{fontSize:"30px", marginBottom:"10px"}}>⚠️</div>
                                     <div style={{color:"#ef6c00", fontSize:"14px", fontWeight:"bold", textTransform:"uppercase"}}>Low Stock Alerts</div>
                                     <div style={{fontSize:"36px", fontWeight:"bold", color:"#ef6c00", margin:"10px 0"}}>{lowStockItems.length}</div>
                                     <div style={{fontSize:"12px", color:"#ef6c00"}}>Current Items Low</div>
                                 </div>

                                 {/* Expired Items Card */}
                                 <div onClick={() => handleReportClick('expired')} style={{background:"#ffebee", border:"1px solid #ffcdd2", padding:"20px", borderRadius:"12px", boxShadow:"0 2px 8px rgba(0,0,0,0.05)", textAlign:"center", cursor: "pointer"}}>
                                     <div style={{fontSize:"30px", marginBottom:"10px"}}>📅</div>
                                     <div style={{color:"#c62828", fontSize:"14px", fontWeight:"bold", textTransform:"uppercase"}}>Expired Items</div>
                                     <div style={{fontSize:"36px", fontWeight:"bold", color:"#c62828", margin:"10px 0"}}>{expiredItems.length}</div>
                                     <div style={{fontSize:"12px", color:"#c62828"}}>Past Expiry Date</div>
                                 </div>

                                 {/* Service Breakdown */}
                                 <div style={{background:"white", border:"1px solid #eee", padding:"20px", borderRadius:"12px", boxShadow:"0 2px 8px rgba(0,0,0,0.05)"}}>
                                     <h5 style={{marginTop:0, borderBottom:"1px solid #eee", paddingBottom:"5px"}}>Service Types</h5>
                                     <div style={{maxHeight:"120px", overflowY:"auto"}}>
                                        {Object.entries(serviceBreakdown).map(([key, val]) => (
                                            <div key={key} style={{display:"flex", justifyContent:"space-between", fontSize:"13px", padding:"4px 0"}}>
                                                <span>{key}</span>
                                                <strong>{val}</strong>
                                            </div>
                                        ))}
                                        {Object.keys(serviceBreakdown).length === 0 && <span style={{color:"#999", fontSize:"12px"}}>No data</span>}
                                     </div>
                                 </div>
                             </div>

                             <div style={{marginTop:"30px", padding:"20px", background:"#f9f9f9", borderRadius:"8px", border:"1px solid #eee"}}>
                                 <h5 style={{margin:"0 0 10px 0"}}>System Note:</h5>
                                 <p style={{margin:0, fontSize:"13px", color:"#666"}}>
                                     This report is generated automatically based on audit logs. 
                                     Click on the stats cards above to view detailed lists.
                                 </p>
                             </div>
                         </div>
                     )}
                 </div>
             )}

         </div>

         {/* --- MODALS --- */}
         {showWalkInModal && (
             <div className="modal-overlay" style={{position:"fixed", top:0, left:0, width:"100%", height:"100%", background:"rgba(0,0,0,0.5)", display:"flex", justifyContent:"center", alignItems:"center", zIndex:2000}}>
                 <div style={{background:"white", padding:"25px", borderRadius:"12px", width:"400px", boxShadow:"0 10px 25px rgba(0,0,0,0.2)"}}>
                     <h3>Create Walk-In Appointment</h3>
                     <form onSubmit={handleCreateWalkIn} style={{display:"flex", flexDirection:"column", gap:"10px"}}>
                         <input type="text" placeholder="Pet Name" required value={walkInData.petName} onChange={e => setWalkInData({...walkInData, petName: e.target.value})} style={{padding:"10px", borderRadius:"8px", border:"1px solid #ccc"}} />
                         <input type="date" required value={walkInData.date} onChange={e => setWalkInData({...walkInData, date: e.target.value})} style={{padding:"10px", borderRadius:"8px", border:"1px solid #ccc"}} />
                         <input type="time" required value={walkInData.time} onChange={e => setWalkInData({...walkInData, time: e.target.value})} style={{padding:"10px", borderRadius:"8px", border:"1px solid #ccc"}} />
                         <select value={walkInData.reason} onChange={e => setWalkInData({...walkInData, reason: e.target.value})} style={{padding:"10px", borderRadius:"8px", border:"1px solid #ccc"}}>
                             <option value="">Select Reason</option>
                             {VISIT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                         </select>
                         <button type="submit" style={{marginTop:"10px", padding:"12px", background:"#673AB7", color:"white", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:"bold"}}>Book Walk-In</button>
                         <button type="button" onClick={() => setShowWalkInModal(false)} style={{padding:"10px", background:"#eee", border:"none", borderRadius:"8px", cursor:"pointer"}}>Cancel</button>
                     </form>
                 </div>
             </div>
         )}

         {showInventoryModal && (
             <div className="modal-overlay" style={{position:"fixed", top:0, left:0, width:"100%", height:"100%", background:"rgba(0,0,0,0.5)", display:"flex", justifyContent:"center", alignItems:"center", zIndex:2000}}>
                 <div style={{background:"white", padding:"25px", borderRadius:"12px", width:"400px"}}>
                     <h3>{editingInventoryId ? "Edit Item" : "Add New Inventory Item"}</h3>
                     <form onSubmit={handleSaveInventory} style={{display:"flex", flexDirection:"column", gap:"10px"}}>
                         <input type="text" placeholder="Item Name" required value={inventoryData.name} onChange={e => setInventoryData({...inventoryData, name: e.target.value})} style={{padding:"10px", border:"1px solid #ccc", borderRadius:"6px"}} />
                         <select required value={inventoryData.category} onChange={e => setInventoryData({...inventoryData, category: e.target.value})} style={{padding:"10px", border:"1px solid #ccc", borderRadius:"6px"}}>
                             <option value="">Select Category</option>
                             {INVENTORY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                         </select>
                         <div style={{display:"flex", gap:"10px"}}>
                             <input type="number" placeholder="Qty" required value={inventoryData.quantity} onChange={e => setInventoryData({...inventoryData, quantity: parseInt(e.target.value)})} style={{flex:1, padding:"10px", border:"1px solid #ccc", borderRadius:"6px"}} />
                             <select value={inventoryData.unit} onChange={e => setInventoryData({...inventoryData, unit: e.target.value})} style={{flex:1, padding:"10px", border:"1px solid #ccc", borderRadius:"6px"}}>
                                 {INVENTORY_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                             </select>
                         </div>
                         {/* ADDED: EXPIRY & THRESHOLD */}
                         <div style={{display:"flex", gap:"10px"}}>
                             <div style={{flex:1}}>
                                 <label style={{fontSize:"12px", fontWeight:"bold"}}>Expiry Date</label>
                                 <input type="date" value={inventoryData.expiryDate} onChange={e => setInventoryData({...inventoryData, expiryDate: e.target.value})} style={{width:"100%", padding:"10px", border:"1px solid #ccc", borderRadius:"6px"}} />
                             </div>
                             <div style={{flex:1}}>
                                 <label style={{fontSize:"12px", fontWeight:"bold"}}>Reorder Level</label>
                                 <input type="number" placeholder="Min Qty" value={inventoryData.threshold} onChange={e => setInventoryData({...inventoryData, threshold: parseInt(e.target.value)})} style={{width:"100%", padding:"10px", border:"1px solid #ccc", borderRadius:"6px"}} />
                             </div>
                         </div>

                         <button type="submit" style={{background:"#4CAF50", color:"white", border:"none", padding:"12px", borderRadius:"6px", cursor:"pointer", fontWeight:"bold"}}>{editingInventoryId ? "Update Item" : "Add Item"}</button>
                         <button type="button" onClick={() => setShowInventoryModal(false)} style={{background:"#eee", border:"none", padding:"10px", borderRadius:"6px", cursor:"pointer"}}>Cancel</button>
                     </form>
                 </div>
             </div>
         )}

         {showConsultModal && (
             <div className="modal-overlay" style={{position:"fixed", top:0, left:0, width:"100%", height:"100%", background:"rgba(0,0,0,0.6)", display:"flex", justifyContent:"center", alignItems:"center", zIndex:2000}}>
                 <div style={{background:"white", padding:"25px", borderRadius:"12px", width:"600px", maxHeight:"90vh", overflowY:"auto"}}>
                     <h2 style={{marginTop:0, borderBottom:"1px solid #eee", paddingBottom:"10px"}}>Consultation Form</h2>
                     <form onSubmit={handleFinishConsultation} style={{display:"flex", flexDirection:"column", gap:"15px"}}>
                         <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"15px"}}>
                             <div>
                                 <label style={{fontSize:"12px", fontWeight:"bold"}}>Date</label>
                                 <input type="date" required value={consultData.date} onChange={e => setConsultData({...consultData, date: e.target.value})} style={{width:"100%", padding:"8px", borderRadius:"6px", border:"1px solid #ccc"}} />
                             </div>
                             <div>
                                 <label style={{fontSize:"12px", fontWeight:"bold"}}>Main Complaint / Reason</label>
                                 <input type="text" value={consultData.reason} onChange={e => setConsultData({...consultData, reason: e.target.value})} style={{width:"100%", padding:"8px", borderRadius:"6px", border:"1px solid #ccc"}} />
                             </div>
                         </div>

                         <div>
                             <label style={{fontSize:"12px", fontWeight:"bold"}}>Symptoms</label>
                             <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:"5px", background:"#f9f9f9", padding:"10px", borderRadius:"8px", maxHeight:"100px", overflowY:"auto"}}>
                                 {SYMPTOM_OPTIONS.map(sym => (
                                     <label key={sym} style={{fontSize:"11px", display:"flex", alignItems:"center", gap:"5px"}}>
                                         <input type="checkbox" checked={consultData.symptoms.includes(sym)} onChange={() => handleSymptomChange(sym)} /> {sym}
                                     </label>
                                 ))}
                             </div>
                         </div>

                         <div>
                             <label style={{fontSize:"12px", fontWeight:"bold"}}>Diagnosis</label>
                             <select required value={consultData.diagnosis} onChange={e => setConsultData({...consultData, diagnosis: e.target.value})} style={{width:"100%", padding:"10px", borderRadius:"6px", border:"1px solid #ccc"}}>
                                 <option value="">Select Diagnosis</option>
                                 {DIAGNOSIS_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                             </select>
                         </div>

                         <div>
                             <label style={{fontSize:"12px", fontWeight:"bold"}}>Prescription / Medicine</label>
                             <textarea value={consultData.medicine} onChange={e => setConsultData({...consultData, medicine: e.target.value})} rows="2" style={{width:"100%", padding:"10px", borderRadius:"6px", border:"1px solid #ccc"}} placeholder="e.g. Doxycycline 100mg 2x a day..."></textarea>
                         </div>

                         <div>
                             <label style={{fontSize:"12px", fontWeight:"bold"}}>Veterinarian Notes</label>
                             <textarea value={consultData.notes} onChange={e => setConsultData({...consultData, notes: e.target.value})} rows="2" style={{width:"100%", padding:"10px", borderRadius:"6px", border:"1px solid #ccc"}} placeholder="Additional observations..."></textarea>
                         </div>

                         <div>
                             <label style={{fontSize:"12px", fontWeight:"bold"}}>Schedule Follow-up (Optional)</label>
                             <input type="date" value={consultData.followUp} onChange={e => setConsultData({...consultData, followUp: e.target.value})} style={{width:"100%", padding:"8px", borderRadius:"6px", border:"1px solid #ccc"}} />
                         </div>

                         <div style={{display:"flex", gap:"10px", marginTop:"10px"}}>
                             <button type="submit" style={{flex:1, background:"#2196F3", color:"white", border:"none", padding:"12px", borderRadius:"6px", fontWeight:"bold", cursor:"pointer"}}>Save & Finish</button>
                             <button type="button" onClick={() => setShowConsultModal(false)} style={{flex:1, background:"#eee", border:"none", padding:"12px", borderRadius:"6px", cursor:"pointer"}}>Cancel</button>
                         </div>
                     </form>
                 </div>
             </div>
         )}

         {viewingPet && (
             <div className="modal-overlay" style={{position:"fixed", top:0, left:0, width:"100%", height:"100%", background:"rgba(0,0,0,0.7)", display:"flex", justifyContent:"center", alignItems:"center", zIndex:2000}}>
                 <div style={{background:"white", width:"600px", maxHeight:"80vh", borderRadius:"12px", overflow:"hidden", display:"flex", flexDirection:"column"}}>
                     <div style={{padding:"20px", background:"#673AB7", color:"white"}}>
                         <h2 style={{margin:0}}>{viewingPet.name}</h2>
                         <div style={{fontSize:"14px", opacity:0.9}}>Owner: {owners.find(o => o.id === viewingPet.ownerId)?.firstName} {owners.find(o => o.id === viewingPet.ownerId)?.lastName}</div>
                         <div style={{fontSize:"13px", color:"#eee"}}>📞 {owners.find(o => o.id === viewingPet.ownerId)?.phoneNumber || owners.find(o => o.id === viewingPet.ownerId)?.contactNumber || "No Phone"}</div>
                     </div>
                     <div style={{flex:1, overflowY:"auto", padding:"20px"}}>
                         <h4>Medical History</h4>
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
                     <button onClick={() => setViewingPet(null)} style={{width:"100%", marginTop:"20px", padding:"10px", background:"#eee", border:"none", borderRadius:"8px", cursor: "pointer"}}>Close</button>
                 </div>
             </div>
         )}
         
         {/* --- REPORT DETAIL MODAL --- */}
         {reportDetailModal && (
            <div className="modal-overlay" style={{position:"fixed", top:0, left:0, width:"100%", height:"100%", background:"rgba(0,0,0,0.6)", display:"flex", justifyContent:"center", alignItems:"center", zIndex:2000}}>
                 <div style={{background:"white", width:"600px", maxHeight:"80vh", borderRadius:"12px", overflow:"hidden", display:"flex", flexDirection:"column"}}>
                     <div style={{padding:"15px 20px", background:"#1565C0", color:"white", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                         <h3 style={{margin:0}}>{reportDetailModal.title}</h3>
                         <button onClick={() => setReportDetailModal(null)} style={{background:"none", border:"none", color:"white", fontSize:"20px", cursor:"pointer"}}>✕</button>
                     </div>
                     <div style={{flex:1, overflowY:"auto", padding:"0"}}>
                         {reportDetailModal.data.length === 0 ? <p style={{padding:"20px", textAlign:"center", color:"#999"}}>No records found.</p> : (
                             <table style={{width:"100%", borderCollapse:"collapse", fontSize:"13px"}}>
                                 <thead style={{background:"#f5f5f5", textAlign:"left"}}>
                                     <tr>
                                         {reportDetailModal.type === 'appointments' ? (
                                            <>
                                                <th style={{padding:"10px", borderBottom:"1px solid #eee"}}>Date</th>
                                                <th style={{padding:"10px", borderBottom:"1px solid #eee"}}>Pet & Owner</th>
                                                <th style={{padding:"10px", borderBottom:"1px solid #eee"}}>Type</th>
                                                <th style={{padding:"10px", borderBottom:"1px solid #eee"}}>Status</th>
                                            </>
                                         ) : reportDetailModal.type === 'lowstock' || reportDetailModal.type === 'expired' ? (
                                             <>
                                                 <th style={{padding:"10px", borderBottom:"1px solid #eee"}}>Item Name</th>
                                                 <th style={{padding:"10px", borderBottom:"1px solid #eee"}}>Quantity</th>
                                                 <th style={{padding:"10px", borderBottom:"1px solid #eee"}}>{reportDetailModal.type === 'lowstock' ? 'Threshold' : 'Expiry Date'}</th>
                                             </>
                                         ) : (
                                            <>
                                                <th style={{padding:"10px", borderBottom:"1px solid #eee"}}>Date</th>
                                                <th style={{padding:"10px", borderBottom:"1px solid #eee"}}>Item Name</th>
                                                <th style={{padding:"10px", borderBottom:"1px solid #eee"}}>Qty {reportDetailModal.type==='added'?'Added':'Used'}</th>
                                            </>
                                         )}
                                     </tr>
                                 </thead>
                                 <tbody>
                                     {reportDetailModal.data.map((row, idx) => {
                                         // Render logic based on type
                                         if (reportDetailModal.type === 'appointments') {
                                             const owner = owners.find(o => o.id === row.ownerId);
                                             return (
                                                 <tr key={idx} style={{borderBottom:"1px solid #f0f0f0"}}>
                                                     <td style={{padding:"10px"}}>{row.date}</td>
                                                     <td style={{padding:"10px"}}>
                                                         <strong>{row.petName}</strong> <br/>
                                                         <span style={{fontSize:"11px", color:"#666"}}>{owner?.firstName} {owner?.lastName}</span>
                                                     </td>
                                                     <td style={{padding:"10px"}}>{row.reason}</td>
                                                     <td style={{padding:"10px"}}>
                                                         <span style={{padding:"2px 6px", borderRadius:"4px", fontSize:"10px", 
                                                             background:row.status==='Done'?'#e3f2fd':row.status==='Cancelled'?'#ffebee':'#fff3e0',
                                                             color:row.status==='Done'?'#2196F3':row.status==='Cancelled'?'#c62828':'#ef6c00'}}>
                                                             {row.status}
                                                         </span>
                                                     </td>
                                                 </tr>
                                             );
                                         } else if (reportDetailModal.type === 'lowstock' || reportDetailModal.type === 'expired') {
                                             return (
                                                 <tr key={idx} style={{borderBottom:"1px solid #f0f0f0"}}>
                                                     <td style={{padding:"10px"}}><strong>{row.name}</strong></td>
                                                     <td style={{padding:"10px"}}>{row.quantity} {row.unit}</td>
                                                     <td style={{padding:"10px", color: reportDetailModal.type === 'expired' ? 'red' : 'orange'}}>
                                                         {reportDetailModal.type === 'lowstock' ? (row.threshold || 5) : (row.expiryDate || "N/A")}
                                                     </td>
                                                 </tr>
                                             );
                                         } else {
                                             // Inventory Logs (Added / Used)
                                             return (
                                                 <tr key={idx} style={{borderBottom:"1px solid #f0f0f0"}}>
                                                     <td style={{padding:"10px"}}>{normalizeDate(row.date)}</td>
                                                     <td style={{padding:"10px"}}><strong>{row.itemName}</strong></td>
                                                     <td style={{padding:"10px", fontWeight:"bold", color: reportDetailModal.type==='added'?'green':'red'}}>
                                                         {reportDetailModal.type==='added' ? '+' : '-'}{row.qty || row.change}
                                                     </td>
                                                 </tr>
                                             );
                                         }
                                     })}
                                 </tbody>
                             </table>
                         )}
                     </div>
                     <div style={{padding:"10px", background:"#f5f5f5", textAlign:"right"}}>
                         <button onClick={() => setReportDetailModal(null)} style={{padding:"8px 15px", background:"#ccc", border:"none", borderRadius:"4px", cursor:"pointer"}}>Close</button>
                     </div>
                 </div>
            </div>
         )}

      </main>
    </div>
  );
};

export default StaffDashboard;
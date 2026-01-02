import { useEffect, useState, useRef, useMemo } from "react";
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
  const [petFilterType, setPetFilterType] = useState("All"); 
  const [viewingPet, setViewingPet] = useState(null); 

  // Chat States
  const [selectedChatOwner, setSelectedChatOwner] = useState(null); 
  const [chatInput, setChatInput] = useState("");
  const [allMessages, setAllMessages] = useState([]);
  const [editingMessageId, setEditingMessageId] = useState(null);

  // --- REPORT STATES ---
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");
  const [reportDetailModal, setReportDetailModal] = useState(null);

  // --- CUSTOM CONFIRMATION MODAL STATE ---
  const [confirmModal, setConfirmModal] = useState({ 
      show: false, 
      message: "", 
      onConfirm: () => {} 
  });

  const [isSavingInventory, setIsSavingInventory] = useState(false); // Add this

  // --- DECLINE REASON MODAL STATE ---
  const [declineModal, setDeclineModal] = useState({ 
      show: false, 
      apptId: null, 
      reason: "" 
  });

  // --- QUICK USAGE MODAL STATE ---
    const [usageModal, setUsageModal] = useState({ 
        show: false, 
        item: null, 
        qty: 1 
  });

  // --- INVENTORY STATES ---
  const [inventory, setInventory] = useState([]);
  const [inventoryLogs, setInventoryLogs] = useState([]);
  const [inventorySearch, setInventorySearch] = useState("");
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [editingInventoryId, setEditingInventoryId] = useState(null); 
  const [inventoryData, setInventoryData] = useState({
      name: "", category: "", quantity: 0, unit: "pcs", expiryDate: "", threshold: 5});
const [inventoryFilter, setInventoryFilter] = useState("All");
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

  // --- DERIVED STATE ---

  const chatMessages = useMemo(() => {
    if (!selectedChatOwner) return [];
    return allMessages.filter(msg => 
        msg.participants && 
        msg.participants.includes(selectedChatOwner.id) && 
        msg.type !== 'notification'
    );
  }, [allMessages, selectedChatOwner]);

  const filteredRecords = useMemo(() => {
    return allPets.filter(pet => {
      const owner = owners.find(o => o.id === pet.ownerId);
      const ownerName = owner ? `${owner.firstName} ${owner.lastName}`.toLowerCase() : "";
      const searchLower = petSearch.toLowerCase();
      
      const matchesSearch = pet.name.toLowerCase().includes(searchLower) || ownerName.includes(searchLower);
      
      let matchesType = true;
      if (petFilterType !== "All") {
          if (petFilterType === "Other") {
              matchesType = pet.species !== "Dog" && pet.species !== "Cat";
          } else {
              matchesType = pet.species === petFilterType;
          }
      }
      return matchesSearch && matchesType;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [allPets, owners, petSearch, petFilterType]);

  const { generatedStats: _generatedStats, serviceBreakdown: _serviceBreakdown } = useMemo(() => {
    const emptyStats = {
        itemsAdded: 0, itemsUsed: 0, totalAppointments: 0,
        completedAppointments: 0, cancelledAppointments: 0,
        addedLogs: [], usedLogs: [], rangeApps: []
    };

    if (!reportStartDate || !reportEndDate) {
        return { generatedStats: emptyStats, serviceBreakdown: {} };
    }

    const start = new Date(reportStartDate);
    const end = new Date(reportEndDate);
    end.setHours(23, 59, 59, 999);

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

    const rangeApps = appointments.filter(app => {
        const appDate = new Date(app.date);
        return appDate >= start && appDate <= end;
    });
    
    const completed = rangeApps.filter(a => a.status === 'Done');
    const cancelled = rangeApps.filter(a => a.status === 'Cancelled');
    
    const breakdown = {};
    rangeApps.forEach(app => {
        const type = app.reason || "Other";
        breakdown[type] = (breakdown[type] || 0) + 1;
    });

    return {
        generatedStats: {
            itemsAdded: added,
            itemsUsed: used,
            totalAppointments: rangeApps.length,
            completedAppointments: completed.length,
            cancelledAppointments: cancelled.length,
            addedLogs,
            usedLogs,
            rangeApps
        },
        serviceBreakdown: breakdown
    };
  }, [reportStartDate, reportEndDate, inventoryLogs, appointments]);

// --- NEW INVENTORY STATS (Updated with Expiry) ---
  const inventoryStats = useMemo(() => {
      // 1. Total Items
      const totalItems = inventory.length;

      // 2. Items per Category
      const categoryCounts = {};
      INVENTORY_CATEGORIES.forEach(cat => categoryCounts[cat] = 0); 
      inventory.forEach(item => {
          const cat = item.category || "Uncategorized";
          categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      });

      // 3. Recently Added Logs (The "+5 boxes" logic)
      const recentActivity = inventoryLogs
          .filter(log => log.change > 0)
          .slice(0, 5)
          .map(log => {
              const item = inventory.find(i => i.id === log.itemId);
              return { id: log.id, name: log.itemName, added: log.change, unit: item ? item.unit : "units" };
          });

      // 4. Expiring Soon (Next 60 days or already expired)
      const today = new Date();
      today.setHours(0,0,0,0);
      const warningDate = new Date();
      warningDate.setDate(today.getDate() + 60); // Adjust days as needed
      
      const expiringItems = inventory.filter(item => {
          if (!item.expiryDate) return false; // Skip if no date
          const exp = new Date(item.expiryDate);
          return exp <= warningDate;
      })
      .sort((a,b) => new Date(a.expiryDate) - new Date(b.expiryDate)) // Oldest/Soonest first
      .slice(0, 5);

      return { totalItems, categoryCounts, recentActivity, expiringItems };
  }, [inventory, inventoryLogs]);

  const appointmentStats = useMemo(() => {
      // 1. Total Appointments
      const totalAppts = appointments.length;

      // 2. Breakdown by Reason
      const reasonCounts = {};
      VISIT_REASONS.forEach(r => reasonCounts[r] = 0); // Initialize known reasons
      appointments.forEach(app => {
          const r = app.reason || "Other";
          reasonCounts[r] = (reasonCounts[r] || 0) + 1;
      });

      // 3. Upcoming Appointments (Next 5)
      const today = new Date().toISOString().split('T')[0];
      const upcoming = appointments
          .filter(app => app.date >= today && app.status !== "Cancelled" && app.status !== "Declined")
          .sort((a, b) => a.date.localeCompare(b.date)) // Sort soonest first
          .slice(0, 5);

      return { totalAppts, reasonCounts, upcoming };
  }, [appointments]);

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
  const getUnreadCount = (ownerId) => allMessages.filter(m => m.senderId === ownerId && !m.read && m.senderId !== "AI_BOT").length;
  
  const totalUnreadMessages = allMessages.filter(m => m.senderId !== auth.currentUser?.uid && !m.read && m.senderId !== "AI_BOT").length;

  const getStockStatus = (item) => {
      if (item.quantity <= 0) return { label: "Out of Stock", color: "#f44336" };
      if (item.quantity <= item.threshold) return { label: "Low Stock", color: "#ff9800" };
      return { label: "In Stock", color: "#4CAF50" };
  };

// --- PRINT SUMMARY REPORT (Fully Updated) ---
  const printSummaryReport = () => {
      const printWindow = window.open('', '_blank');
      
      // 1. Calculate Inventory Stats
      const totalItems = inventory.length;
      const lowStockCount = inventory.filter(i => i.quantity <= i.threshold).length;
      
      // Expiring Soon (Next 60 days)
      const today = new Date(); 
      const warningDate = new Date(); warningDate.setDate(today.getDate() + 60);
      
      const expiringItems = inventory.filter(item => {
          if (!item.expiryDate) return false;
          const exp = new Date(item.expiryDate);
          return exp <= warningDate;
      }).sort((a,b) => new Date(a.expiryDate) - new Date(b.expiryDate)).slice(0, 5);

      // Recently Added Stock (Using Logs for "+5" logic)
      const recentStockLogs = inventoryLogs
          .filter(log => log.change > 0)
          .sort((a,b) => b.timestamp - a.timestamp)
          .slice(0, 5)
          .map(log => {
              const item = inventory.find(i => i.id === log.itemId);
              return { ...log, unit: item ? item.unit : "units" };
          });

      // 2. Calculate Appointment Stats
      const totalAppts = appointments.length;
      const reasonCounts = {};
      VISIT_REASONS.forEach(r => reasonCounts[r] = 0);
      appointments.forEach(app => {
          const r = app.reason || "Other";
          reasonCounts[r] = (reasonCounts[r] || 0) + 1;
      });

      const upcomingAppts = appointments
          .filter(app => app.date >= today.toISOString().split('T')[0] && app.status !== "Cancelled")
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(0, 5);

      printWindow.document.write(`
          <html>
              <head>
                <title>Clinic Status Report</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; }
                    h1 { color: #2c3e50; margin-bottom: 5px; text-align: center; }
                    .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
                    .meta { color: #888; font-size: 14px; }
                    
                    /* Grid Layout (2x2) */
                    .dashboard-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px; }
                    .card { border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
                    .card h3 { margin-top: 0; color: #1976D2; border-bottom: 1px solid #f0f0f0; padding-bottom: 10px; font-size: 16px; }
                    
                    /* Lists */
                    ul { padding-left: 20px; margin: 0; }
                    li { margin-bottom: 6px; font-size: 13px; color: #555; }
                    .highlight { font-weight: bold; color: #333; }
                    .badge-red { color: #d32f2f; font-weight: bold; }
                    .badge-green { color: #2e7d32; font-weight: bold; }
                    
                    /* Table */
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
                    th { background: #f8f9fa; padding: 12px; text-align: left; border-bottom: 2px solid #ddd; font-weight: 600; }
                    td { padding: 10px; border-bottom: 1px solid #eee; }
                    tr:nth-child(even) { background-color: #fcfcfc; }
                </style>
              </head>
              <body>
                  <div class="header">
                      <h1>PawPals Clinic Report</h1>
                      <div class="meta">Generated on ${new Date().toLocaleString()}</div>
                  </div>

                  <div class="dashboard-grid">
                      
                      <div class="card">
                          <h3>📦 Inventory Health</h3>
                          <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                              <span>Total Items:</span>
                              <span class="highlight">${totalItems}</span>
                          </div>
                          <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                              <span>Low Stock Alerts:</span>
                              <span class="${lowStockCount > 0 ? 'badge-red' : 'badge-green'}">${lowStockCount} items</span>
                          </div>
                          <div style="margin-top:15px;">
                              <strong>⚠️ Expiring Soon (< 60 days):</strong>
                              ${expiringItems.length > 0 ? `
                                  <ul style="margin-top:5px;">
                                      ${expiringItems.map(i => `<li>${i.name} - <span class="badge-red">${i.expiryDate}</span></li>`).join('')}
                                  </ul>
                              ` : '<div style="font-style:italic; font-size:12px; color:#888">No expiring items</div>'}
                          </div>
                      </div>

                      <div class="card">
                          <h3>📅 Appointment Overview</h3>
                          <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                              <span>Total Records:</span>
                              <span class="highlight">${totalAppts}</span>
                          </div>
                          <div style="margin-top:10px;">
                              <strong>Breakdown by Reason:</strong>
                              <ul style="margin-top:5px;">
                                  ${Object.entries(reasonCounts).filter(([,c])=>c>0).map(([k,v]) => `<li>${k}: ${v}</li>`).join('')}
                              </ul>
                          </div>
                      </div>

                      <div class="card">
                          <h3>📥 Recently Added Stock</h3>
                          ${recentStockLogs.length > 0 ? `
                              <ul>
                                  ${recentStockLogs.map(log => `
                                      <li>
                                          <strong>${log.itemName}</strong> 
                                          <span class="badge-green">+${log.change} ${log.unit}</span>
                                      </li>
                                  `).join('')}
                              </ul>
                          ` : '<div style="color:#888; font-style:italic">No recent additions</div>'}
                      </div>

                      <div class="card">
                          <h3>🔜 Upcoming Schedule</h3>
                          ${upcomingAppts.length > 0 ? `
                              <ul>
                                  ${upcomingAppts.map(app => `
                                      <li>
                                          <strong>${app.date}</strong>: ${app.petName} 
                                          <br/><span style="color:#888; font-size:11px">${app.reason}</span>
                                      </li>
                                  `).join('')}
                              </ul>
                          ` : '<div style="color:#888; font-style:italic">No upcoming appointments</div>'}
                      </div>
                  </div>

                  <h3>Detailed Inventory List</h3>
                  <table>
                      <thead>
                          <tr>
                              <th>Item Name</th>
                              <th>Category</th>
                              <th>Quantity</th>
                              <th>Expiry Date</th>
                              <th>Status</th>
                          </tr>
                      </thead>
                      <tbody>
                          ${inventory.map(item => `
                              <tr>
                                  <td>${item.name}</td>
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
  };
// --- PRINT INVENTORY REPORT (Dedicated) ---
  const printInventoryReport = () => {
      const printWindow = window.open('', '_blank');
      
      const today = new Date().toLocaleDateString();
      const totalItems = inventory.length;
      
      // Generate rows
      const tableRows = inventory.map(item => {
          const status = getStockStatus(item);
          return `
              <tr>
                  <td>${item.name}</td>
                  <td>${item.category}</td>
                  <td>${item.quantity}</td>
                  <td>${item.unit}</td>
                  <td>${item.expiryDate || "-"}</td>
                  <td style="color:${status.color}; font-weight:bold;">${status.label}</td>
              </tr>
          `;
      }).join('');

      printWindow.document.write(`
          <html>
              <head>
                  <title>Inventory Report</title>
                  <style>
                      body { font-family: sans-serif; padding: 20px; color: #333; }
                      h1 { margin-bottom: 5px; color: #2c3e50; }
                      .meta { color: #666; font-size: 14px; margin-bottom: 20px; border-bottom: 2px solid #eee; padding-bottom: 10px; }
                      table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
                      th { background: #f4f4f4; padding: 10px; text-align: left; border-bottom: 2px solid #ddd; }
                      td { padding: 8px; border-bottom: 1px solid #eee; }
                      tr:nth-child(even) { background-color: #fafafa; }
                  </style>
              </head>
              <body>
                  <h1>📦 Current Inventory Report</h1>
                  <div class="meta">
                      Generated: ${today} <br/>
                      Total Items: ${totalItems}
                  </div>
                  <table>
                      <thead>
                          <tr>
                              <th>Item Name</th>
                              <th>Category</th>
                              <th>Qty</th>
                              <th>Unit</th>
                              <th>Expiry</th>
                              <th>Status</th>
                          </tr>
                      </thead>
                      <tbody>
                          ${tableRows}
                      </tbody>
                  </table>
              </body>
          </html>
      `);
      
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
  };
  // --- ACTIONS ---
  const handleStatusUpdate = async (id, newStatus) => { await updateDoc(doc(db, "appointments", id), { status: newStatus, staffId: auth.currentUser.uid }); };
  
  // --- DECLINE ACTIONS ---
  const openDeclineModal = (apptId) => {
      setDeclineModal({ show: true, apptId, reason: "" });
  };

  const handleConfirmDecline = async () => {
      if (!declineModal.reason.trim()) return showToast("Please provide a reason.", "error");
      
      try {
          await updateDoc(doc(db, "appointments", declineModal.apptId), {
              status: "Cancelled", 
              cancellationReason: declineModal.reason,
              staffId: auth.currentUser.uid,
              lastUpdated: new Date()
          });
          showToast("Appointment declined.");
          setDeclineModal({ show: false, apptId: null, reason: "" });
      } catch (err) {
          console.error(err);
          showToast("Error declining appointment.", "error");
      }
  };

  // --- INVENTORY ACTIONS ---
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

    const handleDeleteInventory = (id) => {
      setConfirmModal({
          show: true,
          message: "Are you sure you want to delete this item? This cannot be undone.",
          onConfirm: async () => {
              try {
                  await deleteDoc(doc(db, "inventory", id));
                  showToast("Item deleted.", "error");
              } catch (err) {
                  console.error(err);
                  showToast("Error deleting item.", "error");
              }
          }
      });
  };

const confirmQuickUsage = async () => {
    const { item, qty } = usageModal;
    if (!item || qty <= 0) return;

    if (item.quantity < qty) {
        showToast("Not enough stock available", "error");
        return;
    }

    try {
        await updateDoc(doc(db, "inventory", item.id), {
            quantity: item.quantity - qty,
            lastUpdated: new Date()
        });
        
        await addDoc(collection(db, "inventoryLogs"), {
            itemId: item.id,
            itemName: item.name,
            change: -qty,
            reason: "Quick Usage",
            timestamp: new Date()
        });
        showToast(`Recorded usage of ${qty} ${item.unit}`);
        setUsageModal({ show: false, item: null, qty: 1 });
    } catch (err) {
        console.error(err);
        showToast("Error updating stock", "error");
    }
  };

const handleSaveInventory = async (e) => {
      e.preventDefault();
      if (isSavingInventory) return; // Stop if already saving

      setIsSavingInventory(true); // Lock the button
      try {
          if (editingInventoryId) {
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
              const docRef = await addDoc(collection(db, "inventory"), {
                  ...inventoryData,
                  createdAt: new Date()
              });
              
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
      } finally {
          setIsSavingInventory(false); // Unlock the button no matter what
      }
  };

  // --- CALENDAR APP CLICK HANDLER ---
  const handleCalendarApptClick = (appt) => {
      setApptSubTab(appt.status);
      setApptViewMode("list");
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

  const handleLogout = () => { setConfirmModal ({ show: true, message: "Are you sure want to log out?", onConfirm: async () => {await signOut(auth); navigate("/");
        }
    }); 
};
  
  const handleCreateWalkIn = async (e) => {
      e.preventDefault();
      const selectedDate = new Date(walkInData.date);
      if (selectedDate.getDay() === 6) return showToast("Cannot book on Saturdays. Clinic is closed.", "error");

      const qConflict = query(collection(db, "appointments"), where("date", "==", walkInData.date), where("time", "==", walkInData.time));
      const snapshot = await getDocs(qConflict);
      const hasConflict = snapshot.docs.some(doc => doc.data().status !== "Cancelled");

      if (hasConflict) {
          return showToast(`Time slot ${walkInData.time} is already booked!`, "error");
      }

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
      
      // Filter out appointments that are already marked as read in DB
      appointments.filter(a => a.status === 'Pending' && !a.read).forEach(a => {
          notifs.push({ 
              id: a.id, 
              type: 'appointment', 
              subType: 'Pending', 
              text: `New Request: ${a.petName} (${a.date})`, 
              date: a.createdAt?.toDate ? a.createdAt.toDate() : new Date(), 
              linkTab: 'appointments', 
              linkSubTab: 'Pending' 
          });
      });

      // Filter out cancelled apps that are read
      appointments.filter(a => a.status === 'Cancelled' && !a.read).slice(0, 5).forEach(a => {
          notifs.push({ 
              id: a.id, 
              type: 'appointment', 
              subType: 'Cancelled', 
              text: `Cancelled: ${a.petName}`, 
              date: a.createdAt?.toDate ? a.createdAt.toDate() : new Date(), 
              linkTab: 'appointments', 
              linkSubTab: 'Cancelled' 
          });
      });

      // Messages (already have a 'read' field in your DB, so this works fine)
      const unreadMsgs = allMessages.filter(m => m.senderId !== auth.currentUser.uid && !m.read && m.senderId !== "AI_BOT");
      const unreadOwners = [...new Set(unreadMsgs.map(m => m.senderId))];
      
      unreadOwners.forEach(ownerId => {
          const owner = owners.find(o => o.id === ownerId);
          notifs.push({ 
              id: `msg-${ownerId}`, 
              type: 'message', 
              text: `Msg from ${owner ? owner.firstName : 'Client'}`, 
              date: new Date(), 
              linkTab: 'messages', 
              ownerData: owner 
          });
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
  
const handleMarkAllRead = async () => { const currentIds = notificationList.map(n => n.id);
    setReadNotifIds(prev => [...prev, ...currentIds]);
    notificationList.forEach(async (notif) => {
        try {
              if (notif.type === 'message') {
                  // For messages, we find all unread messages from that sender
                  const senderId = notif.id.replace('msg-', '');
                  const unreadMsgs = allMessages.filter(m => m.senderId === senderId && !m.read);
                  unreadMsgs.forEach(async (msg) => {
                      await updateDoc(doc(db, "messages", msg.id), { read: true });
                  });
              } else if (notif.type === 'appointment') {
                  await updateDoc(doc(db, "appointments", notif.id), { read: true });
              }
          } catch (err) { console.error("Error marking as read:", err); }
      });
  };

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
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  return (
    <div className="dashboard-container" style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f5f5" }}>
      {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({...toast, show: false})} />}
      
      <nav className="navbar" style={{ flexShrink: 0 }}>
        <div className="logo"><img src={logoImg} alt="PawPals" className="logo-img" /> PawPals Staff</div>
        <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
          
          <div style={{ position: "relative" }}>
              <button onClick={() => { if (!showNotifications) { handleMarkAllRead (); }
                
                setShowNotifications(!showNotifications);
                 }}
                style={{ background: "none", border: "none", fontSize: "24px", cursor: "pointer" }}>
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
          <button style={getTabStyle("appointments")} onClick={() => setActiveTab("appointments")}>Appointments</button>
          <button style={getTabStyle("records")} onClick={() => setActiveTab("records")}>Pet Records</button>
          <button style={getTabStyle("messages")} onClick={() => setActiveTab("messages")}> Messages {totalUnreadMessages > 0 && ( <span style={{background:"red", color:"white", borderRadius:"50%", padding:"2px 8px", fontSize:"12px", marginLeft:"5px"}}> {totalUnreadMessages} </span> )} </button>
          <button style={getTabStyle("inventory")} onClick={() => setActiveTab("inventory")}>Inventory</button>
          <button style={getTabStyle("reports")} onClick={() => setActiveTab("reports")}>Reports</button>
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
                                <span style={{display:"flex", alignItems:"center", gap:"5px"}}><div style={{width:"10px", height:"10px", background:"orange", borderRadius:"2px"}}></div> Pending</span>
                                <span style={{display:"flex", alignItems:"center", gap:"5px"}}><div style={{width:"10px", height:"10px", background:"green", borderRadius:"2px"}}></div> Approved/Done</span>
                            </div>
                        </div>
                    ) : (
                        <div style={{display: "flex", flexDirection: "column", height: "100%", overflow: "hidden"}}>
                            <div style={{ display: "flex", gap: "10px", marginBottom: "15px", overflowX: "auto", paddingBottom: "5px", flexShrink: 0 }}>
                                {["Pending", "Approved", "Done", "Cancelled"].map(status => (
                                    <button key={status} onClick={() => setApptSubTab(status)} style={{ padding: "8px 15px", border: "1px solid #ddd", borderRadius: "20px", background: apptSubTab === status ? "#2196F3" : "white", color: apptSubTab === status ? "white" : "#333", cursor: "pointer", transition: "all 0.2s" }}>{status}</button>
                                ))}
                            </div>
                            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
                                {filteredAppointments.length === 0 ? <p style={{ textAlign: "center", color: "#888", marginTop: "20px" }}>No {apptSubTab.toLowerCase()} appointments.</p> : (
                                    filteredAppointments.map(appt => (
                                        <div key={appt.id} className="list-item" style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                                            <div>
                                                <div style={{fontWeight:"bold", fontSize:"16px"}}>{appt.petName} <span style={{fontSize:"12px", color:"#666", fontWeight:"normal"}}>({appt.type || 'Regular'})</span></div>
                                                <div style={{fontSize:"14px", color:"#555"}}>📅 {appt.date} at {appt.time}</div>
                                                <div style={{fontSize:"14px", color:"#777"}}>Reason: {appt.reason}</div>
                                            </div>
                                            <div style={{display:"flex", gap:"10px"}}>
                                                {appt.status === "Pending" && (
                                                    <>
                                                        <button onClick={() => handleStatusUpdate(appt.id, "Approved")} className="action-btn" style={{background:"#4CAF50"}}>Approve</button>
                                                        {/* UPDATED: Open Modal instead of direct update */}
                                                        <button onClick={() => openDeclineModal(appt.id)} className="action-btn" style={{background:"#f44336"}}>Decline</button>
                                                    </>
                                                )}
                                                {appt.status === "Approved" && (
                                                    <>
                                                        <button onClick={() => openConsultModal(appt.id)} className="action-btn" style={{background:"#2196F3"}}>Consultation</button>
                                                        <button onClick={() => handleStatusUpdate(appt.id, "Cancelled")} className="action-btn" style={{background:"#f44336"}}>Cancel</button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ... (RECORDS TAB, MESSAGES TAB, INVENTORY TAB, REPORTS TAB remain unchanged) ... */}
            
            {/* --- RECORDS TAB (UPDATED) --- */}
            {activeTab === "records" && (
                <div className="card" style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: "20px", boxSizing: "border-box" }}>
                    <h3>Pet Records</h3>
                    <span style={{ marginLeft: "15px", fontSize: "16px", color: "#666", fontWeight: "normal" }}>
                        Total: {filteredRecords.length}
                    </span>
                    
                    {/* Filter Controls */}
                    <div style={{ display: "flex", gap: "15px", marginBottom: "15px" }}>
                        <input 
                            type="text" 
                            placeholder="Search pet or owner name..." 
                            value={petSearch} 
                            onChange={(e) => setPetSearch(e.target.value)} 
                            style={{ flex: 1, padding: "10px", border: "1px solid #ddd", borderRadius: "6px" }} 
                        />
                        <div style={{ display: "flex", background: "#f1f1f1", borderRadius: "8px", padding: "4px" }}>
                            {["All", "Dog", "Cat", "Other"].map(type => (
                                <button 
                                    key={type} 
                                    onClick={() => setPetFilterType(type)}
                                    style={{
                                        background: petFilterType === type ? "white" : "transparent",
                                        color: petFilterType === type ? "#2196F3" : "#666",
                                        fontWeight: petFilterType === type ? "bold" : "normal",
                                        border: "none",
                                        borderRadius: "6px",
                                        padding: "6px 15px",
                                        cursor: "pointer",
                                        boxShadow: petFilterType === type ? "0 2px 4px rgba(0,0,0,0.1)" : "none",
                                        transition: "all 0.2s"
                                    }}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    <div style={{ flex: 1, overflowY: "auto" }}>
                        {viewingPet ? (
                            <div>
                                <button onClick={() => setViewingPet(null)} style={{ marginBottom: "15px", padding: "5px 10px", cursor: "pointer", border:"1px solid #ccc", borderRadius:"4px", background:"white" }}>← Back to List</button>
                                <div style={{ background: "#f9f9f9", padding: "20px", borderRadius: "8px", border: "1px solid #ddd" }}>
                                    <h2 style={{ marginTop: 0 }}>{viewingPet.name} <span style={{ fontSize: "16px", color: "#666", fontWeight: "normal" }}>({viewingPet.species} - {viewingPet.breed})</span></h2>
                                    <p><strong>Owner:</strong> {owners.find(o => o.id === viewingPet.ownerId)?.firstName} {owners.find(o => o.id === viewingPet.ownerId)?.lastName}</p>
                                    <p><strong>Contact:</strong> {owners.find(o => o.id === viewingPet.ownerId)?.phone || owners.find(o => o.id === viewingPet.ownerId)?.phoneNumber || "N/A"}</p>
                                    <p><strong>Age:</strong> {viewingPet.age} | <strong>Gender:</strong> {viewingPet.gender}</p>
                                    
                                    <h4 style={{ marginTop: "20px", borderBottom: "1px solid #ccc", paddingBottom: "5px" }}>Medical History</h4>
                                    {appointments.filter(a => a.petId === viewingPet.id && a.status === "Done").length === 0 ? <p style={{color:"#888"}}>No history yet.</p> : (
                                        appointments.filter(a => a.petId === viewingPet.id && a.status === "Done").map(hist => (
                                            <div key={hist.id} style={{ background: "white", padding: "10px", borderRadius: "6px", marginBottom: "10px", border: "1px solid #eee" }}>
                                                <div style={{ fontWeight: "bold", color: "#2196F3" }}>{hist.date} - {hist.reason}</div>
                                                <div style={{ fontSize: "14px", marginTop: "5px" }}><strong>Diagnosis:</strong> {hist.diagnosis}</div>
                                                <div style={{ fontSize: "14px" }}><strong>Treatment:</strong> {hist.medicine}</div>
                                                {hist.notes && <div style={{ fontSize: "13px", color: "#555", marginTop: "5px", fontStyle: "italic" }}>"{hist.notes}"</div>}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        ) : (
                            <table style={{ width: "100%", borderCollapse: "collapse", background: "white" }}>
                                <thead style={{ position: "sticky", top: 0, background: "#fafafa", zIndex: 5, boxShadow: "0 2px 5px rgba(0,0,0,0.05)" }}>
                                    <tr style={{ textAlign: "left", color: "#555" }}>
                                        <th style={{ padding: "12px", borderBottom: "2px solid #eee" }}>Pet Name</th>
                                        <th style={{ padding: "12px", borderBottom: "2px solid #eee" }}>Species / Breed</th>
                                        <th style={{ padding: "12px", borderBottom: "2px solid #eee" }}>Owner</th>
                                        <th style={{ padding: "12px", borderBottom: "2px solid #eee" }}>Contact</th>
                                        <th style={{ padding: "12px", borderBottom: "2px solid #eee" }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRecords.length === 0 ? (
                                        <tr><td colSpan="5" style={{ padding: "20px", textAlign: "center", color: "#888" }}>No pets found matching filters.</td></tr>
                                    ) : (
                                        filteredRecords.map(pet => {
                                            const owner = owners.find(o => o.id === pet.ownerId);
                                            return (
                                                <tr key={pet.id} style={{ borderBottom: "1px solid #f1f1f1" }}>
                                                    <td style={{ padding: "12px", fontWeight: "bold", fontSize:"15px" }}>{pet.name}</td>
                                                    <td style={{ padding: "12px" }}>
                                                        {pet.species === "Cat" ? "🐱" : pet.species === "Dog" ? "🐶" : "🐾"} {pet.species} 
                                                        <br/><span style={{ fontSize: "12px", color: "#888" }}>{pet.breed}</span>
                                                    </td>
                                                    <td style={{ padding: "12px" }}>
                                                        {owner ? `${owner.firstName} ${owner.lastName}` : "Unknown Owner"}
                                                    </td>
                                                    <td style={{ padding: "12px", color: "#555" }}>
                                                        {owner?.phone || owner?.phoneNumber || <span style={{color:"#ccc"}}>N/A</span>}
                                                    </td>
                                                    <td style={{ padding: "12px" }}>
                                                        <button 
                                                            onClick={() => setViewingPet(pet)} 
                                                            style={{ 
                                                                background: "#e3f2fd", 
                                                                color: "#1565C0", 
                                                                border: "none", 
                                                                padding: "6px 12px", 
                                                                borderRadius: "4px", 
                                                                cursor: "pointer", 
                                                                fontWeight: "bold", 
                                                                fontSize: "13px" 
                                                            }}
                                                        >
                                                            View
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* --- MESSAGES TAB --- */}
            {activeTab === "messages" && (
                <div className="card" style={{ width: "100%", height: "100%", display: "flex", padding: 0, overflow: "hidden" }}>
                    <div style={{ width: "300px", borderRight: "1px solid #eee", display: "flex", flexDirection: "column", background: "#f9f9f9" }}>
                        <div style={{ padding: "15px", fontWeight: "bold", borderBottom: "1px solid #ddd", background: "white" }}>Client List</div>
                        <div style={{ flex: 1, overflowY: "auto" }}>
                            {owners.map(owner => {
                                const unread = getUnreadCount(owner.id);
                                return (
                                    <div key={owner.id} onClick={() => setSelectedChatOwner(owner)} style={{ padding: "15px", cursor: "pointer", background: selectedChatOwner?.id === owner.id ? "#e3f2fd" : "transparent", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between" }}>
                                        <span>{owner.firstName} {owner.lastName}</span>
                                        {unread > 0 && <span style={{ background: "red", color: "white", borderRadius: "50%", padding: "2px 8px", fontSize: "12px" }}>{unread}</span>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "white" }}>
                        {selectedChatOwner ? (
                            <>
                                <div style={{ padding: "15px", borderBottom: "1px solid #eee", fontWeight: "bold", background: "#f1f1f1" }}>Chat with {selectedChatOwner.firstName}</div>
                                <div style={{ flex: 1, padding: "20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
                                    {chatMessages.length === 0 && <p style={{ textAlign: "center", color: "#888" }}>No messages yet.</p>}
                                    {chatMessages.map(msg => (
                                        <div key={msg.id} style={{ alignSelf: msg.senderId === auth.currentUser.uid ? "flex-end" : "flex-start", maxWidth: "70%", display: "flex", flexDirection: "column", alignItems: msg.senderId === auth.currentUser.uid ? "flex-end" : "flex-start" }}>
                                            <div style={{ background: msg.senderId === auth.currentUser.uid ? "#2196F3" : "#eee", color: msg.senderId === auth.currentUser.uid ? "white" : "#333", padding: "10px 15px", borderRadius: "15px", fontSize: "14px" }}>
                                                {msg.text}
                                                <div style={{ fontSize: "10px", marginTop: "5px", textAlign: "right", opacity: 0.7 }}>
                                                {msg.createdAt?.toDate 
                                                    ? (msg.createdAt.toDate ? msg.createdAt.toDate() : new Date(msg.createdAt)).toLocaleString([], {year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'})
                                                    : "Just now"
                                                }
                                                </div>
                                            </div>
                                            {msg.senderId === auth.currentUser.uid && (
                                                <button onClick={() => handleStartEdit(msg)} style={{fontSize:"10px", border:"none", background:"none", color:"#999", cursor:"pointer", marginTop:"2px"}}>Edit</button>
                                            )}
                                        </div>
                                    ))}
                                    <div ref={scrollRef} />
                                </div>
                                <form onSubmit={handleSendMessage} style={{ padding: "15px", borderTop: "1px solid #eee", display: "flex", gap: "10px" }}>
                                    <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Type a message..." style={{ flex: 1, padding: "10px", borderRadius: "20px", border: "1px solid #ddd" }} />
                                    {editingMessageId && <button type="button" onClick={handleCancelEdit} style={{background:"#999", color:"white", border:"none", padding:"0 15px", borderRadius:"20px", cursor:"pointer"}}>Cancel</button>}
                                    <button type="submit" style={{ background: "#2196F3", color: "white", border: "none", padding: "10px 20px", borderRadius: "20px", cursor: "pointer", fontWeight: "bold" }}>{editingMessageId ? "Update" : "Send"}</button>
                                </form>
                            </>
                        ) : (
                            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#888" }}>Select a client to start chatting</div>
                        )}
                    </div>
                </div>
            )}

            {/* --- INVENTORY TAB --- */}
            {activeTab === "inventory" && (
                 <div className="card" style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: "20px", boxSizing: "border-box" }}>
                    <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"15px"}}>
                        <h3>Inventory Management</h3>
                        <div style={{display:"flex", gap:"10px"}}>
                            <button onClick={printInventoryReport} style={{background:"#607D8B", color:"white", border:"none", padding:"8px 15px", borderRadius:"6px", cursor:"pointer"}}>🖨️ Print Report</button>
                            <button onClick={handleOpenAddInventory} style={{background:"#4CAF50", color:"white", border:"none", padding:"8px 15px", borderRadius:"6px", cursor:"pointer", fontWeight:"bold"}}>+ Add Item</button>
                        </div>
                    </div>

                    {/* --- NEW SUB-TABS --- */}
                    <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
                        <button 
                            onClick={() => setInventoryFilter("All")} 
                            style={{
                                padding: "8px 15px", borderRadius: "20px", border: "none", cursor: "pointer", fontWeight: "bold",
                                background: inventoryFilter === "All" ? "#2196F3" : "#e0e0e0",
                                color: inventoryFilter === "All" ? "white" : "#333"
                            }}
                        >
                            All Items
                        </button>
                        <button 
                            onClick={() => setInventoryFilter("LowStock")} 
                            style={{
                                padding: "8px 15px", borderRadius: "20px", border: "none", cursor: "pointer", fontWeight: "bold",
                                background: inventoryFilter === "LowStock" ? "#ff9800" : "#e0e0e0",
                                color: inventoryFilter === "LowStock" ? "white" : "#333"
                            }}
                        >
                            ⚠️ Low Stock
                        </button>
                    </div>

                    <input type="text" placeholder="Search Inventory..." value={inventorySearch} onChange={(e) => setInventorySearch(e.target.value)} style={{padding:"10px", borderRadius:"6px", border:"1px solid #ddd", marginBottom:"15px", width:"100%", boxSizing:"border-box"}}/>
                    
                    <div style={{flex:1, overflowY:"auto"}}>
                        <table style={{width:"100%", borderCollapse:"collapse", fontSize:"14px"}}>
                            <thead style={{background:"#f1f1f1", position:"sticky", top:0}}>
                                <tr>
                                    <th style={{padding:"10px", textAlign:"left"}}>Item Name</th>
                                    <th style={{padding:"10px", textAlign:"left"}}>Category</th>
                                    <th style={{padding:"10px", textAlign:"left"}}>Stock</th>
                                    <th style={{padding:"10px", textAlign:"left"}}>Expiry</th>
                                    <th style={{padding:"10px", textAlign:"left"}}>Status</th>
                                    <th style={{padding:"10px", textAlign:"center"}}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {inventory
                                    .filter(i => {
                                        // Filter Logic: Check Search AND Check Tab Selection
                                        const matchesSearch = i.name.toLowerCase().includes(inventorySearch.toLowerCase());
                                        const matchesTab = inventoryFilter === "All" || i.quantity <= (i.threshold || 5);
                                        return matchesSearch && matchesTab;
                                    })
                                    .map(item => {
                                    const status = getStockStatus(item);
                                    return (
                                        <tr key={item.id} style={{borderBottom:"1px solid #eee"}}>
                                            <td style={{padding:"10px"}}>{item.name}</td>
                                            <td style={{padding:"10px"}}>{item.category}</td>
                                            <td style={{padding:"10px", fontWeight:"bold"}}>{item.quantity} {item.unit}</td>
                                            <td style={{padding:"10px", color: status.label === 'Expired' ? 'red' : 'inherit'}}>{item.expiryDate || "-"}</td>
                                            <td style={{padding:"10px"}}><span style={{background:status.color, color:"white", padding:"3px 8px", borderRadius:"12px", fontSize:"11px"}}>{status.label}</span></td>
                                            <td style={{padding:"10px", textAlign:"center"}}>
                                                <button onClick={() => handleOpenEditInventory(item)} style={{background:"#2196F3", color:"white", border:"none", padding:"5px 10px", borderRadius:"4px", marginRight:"5px", cursor:"pointer", fontSize:"11px"}}>Edit</button>
                                                <button onClick={() => handleDeleteInventory(item.id)} style={{background:"#f44336", color:"white", border:"none", padding:"5px 10px", borderRadius:"4px", cursor:"pointer", fontSize:"11px"}}>Delete</button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {/* Optional: Message when list is empty */}
                        {inventory.filter(i => (inventoryFilter === "All" || i.quantity <= (i.threshold || 5)) && i.name.toLowerCase().includes(inventorySearch.toLowerCase())).length === 0 && (
                            <div style={{textAlign:"center", color:"#999", padding:"20px"}}>No items found.</div>
                        )}
                    </div>
                 </div>
            )}

            {/* --- REPORTS TAB --- */}
            {activeTab === "reports" && (
                <div className="card" style={{ width: "100%", height: "100%", overflowY: "auto", padding: "30px", boxSizing: "border-box" }}>
                    <div style={{maxWidth:"800px", margin:"0 auto"}}>
                        <h2 style={{textAlign:"center", color:"#333", marginBottom:"30px"}}>Clinic Performance Reports</h2>
                        
                        <div style={{background:"#f5f5f5", padding:"20px", borderRadius:"12px", display:"flex", gap:"15px", alignItems:"center", justifyContent:"center", marginBottom:"30px", border:"1px solid #ddd"}}>
                            <label><strong>From:</strong> <input type="date" value={reportStartDate} onChange={(e) => setReportStartDate(e.target.value)} style={{padding:"8px", borderRadius:"6px", border:"1px solid #ccc"}} /></label>
                            <label><strong>To:</strong> <input type="date" value={reportEndDate} onChange={(e) => setReportEndDate(e.target.value)} style={{padding:"8px", borderRadius:"6px", border:"1px solid #ccc"}} /></label>
                            {(reportStartDate && reportEndDate) && <button onClick={printSummaryReport} style={{marginLeft:"15px", background:"#607D8B", color:"white", border:"none", padding:"8px 15px", borderRadius:"6px", cursor:"pointer"}}>🖨️ Print Summary</button>}
                        </div>

                        {(reportStartDate && reportEndDate) ? (
                            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"20px"}}>
                                {/* Inventory Stats Block */}
                        <div style={{ background: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)", marginBottom: "20px" }}>
                            <h4 style={{ marginTop: 0, color: "#444", borderBottom: "1px solid #eee", paddingBottom: "10px" }}>
                        Inventory Overview
                        </h4>
    
                        <div style={{ display: "flex", gap: "40px", flexWrap: "wrap", marginTop: "15px" }}>
                        {/* Total Count */}
                        <div style={{ flex: "1", minWidth: "150px", borderRight: "1px solid #eee" }}>
                        <div style={{ fontSize: "14px", color: "#888" }}>Total Unique Items</div>
                        <div style={{ fontSize: "32px", fontWeight: "bold", color: "#2196F3" }}>
                            {inventoryStats.totalItems}
                        </div>
                    <div style={{ fontSize: "12px", color: "#666" }}>Across {INVENTORY_CATEGORIES.length} categories</div>
                </div>

                    {/* Category Breakdown */}
                <div style={{ flex: "2", minWidth: "250px", borderRight: "1px solid #eee" }}>
                    <div style={{ fontSize: "14px", color: "#888", marginBottom: "10px" }}>Items by Category</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    {Object.entries(inventoryStats.categoryCounts).map(([cat, count]) => (
                        <div key={cat} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                            <span>{cat}:</span>
                            <span style={{ fontWeight: "bold" }}>{count}</span>
                        </div>
                     ))}
                </div>
            </div>

{/* Recently Added (Shows what was just added) */}
        <div style={{ flex: "2", minWidth: "250px" }}>
            <div style={{ fontSize: "14px", color: "#888", marginBottom: "10px" }}>Recently Added Stock</div>
            {inventoryStats.recentActivity.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px", color: "#555" }}>
                    {inventoryStats.recentActivity.map(log => (
                        <li key={log.id} style={{ marginBottom: "5px" }}>
                            <strong>{log.name}</strong> 
                            {/* Shows "+5 boxes" in green */}
                            <span style={{ color: "#2e7d32", fontWeight: "bold", marginLeft: "6px" }}>
                                +{log.added} {log.unit}
                            </span>
                        </li>
                    ))}
                </ul>
            ) : (
                <div style={{ fontSize: "13px", color: "#aaa", fontStyle: "italic" }}>No recent additions</div>
            )}
        </div>
    </div>
</div>


                                {/* Appointments Stats Block */}
<div style={{ background: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)", marginBottom: "20px" }}>
    <h4 style={{ marginTop: 0, color: "#444", borderBottom: "1px solid #eee", paddingBottom: "10px" }}>
        📅 Appointment Overview
    </h4>
    
    <div style={{ display: "flex", gap: "40px", flexWrap: "wrap", marginTop: "15px" }}>
        {/* Total Count */}
        <div style={{ flex: "1", minWidth: "150px", borderRight: "1px solid #eee" }}>
            <div style={{ fontSize: "14px", color: "#888" }}>Total Appointments</div>
            <div style={{ fontSize: "32px", fontWeight: "bold", color: "#4CAF50" }}>
                {appointmentStats.totalAppts}
            </div>
            <div style={{ fontSize: "12px", color: "#666" }}>All time records</div>
        </div>

        {/* Reason Breakdown */}
        <div style={{ flex: "2", minWidth: "250px", borderRight: "1px solid #eee" }}>
            <div style={{ fontSize: "14px", color: "#888", marginBottom: "10px" }}>By Visit Reason</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                {Object.entries(appointmentStats.reasonCounts).map(([reason, count]) => (
                    count > 0 && (
                        <div key={reason} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                            <span>{reason}:</span>
                            <span style={{ fontWeight: "bold" }}>{count}</span>
                        </div>
                    )
                ))}
            </div>
        </div>

        {/* Upcoming List */}
        <div style={{ flex: "2", minWidth: "250px" }}>
            <div style={{ fontSize: "14px", color: "#888", marginBottom: "10px" }}>Upcoming Appointments</div>
            {appointmentStats.upcoming.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px", color: "#555" }}>
                    {appointmentStats.upcoming.map(app => (
                        <li key={app.id} style={{ marginBottom: "5px" }}>
                            <strong>{app.date}</strong> - {app.petName} <span style={{color:"#999"}}>({app.reason})</span>
                        </li>
                    ))}
                </ul>
            ) : (
                <div style={{ fontSize: "13px", color: "#aaa", fontStyle: "italic" }}>No upcoming appointments</div>
            )}
        </div>
    </div>
</div>
                            </div>
                        ) : (
                            <div style={{textAlign:"center", color:"#888", padding:"50px", border:"2px dashed #ddd", borderRadius:"12px"}}>
                                Please select a date range to generate the report.
                            </div>
                        )}
                    </div>
                </div>
            )}
            
        </div>
      </main>

      {/* --- MODALS --- */}
      {/* 1. Walk In Modal */}
      {showWalkInModal && (
          <div className="modal-overlay" style={{position:"fixed", top:0, left:0, width:"100%", height:"100%", background:"rgba(0,0,0,0.5)", display:"flex", justifyContent:"center", alignItems:"center", zIndex:2000}}>
              <div style={{background:"white", padding:"25px", borderRadius:"12px", width:"400px", maxWidth:"90%"}}>
                  <h3 style={{marginTop:0}}>New Walk-In Appointment</h3>
                  <form onSubmit={handleCreateWalkIn} style={{display:"flex", flexDirection:"column", gap:"15px"}}>
                      <select required value={walkInData.ownerId} onChange={e => setWalkInData({...walkInData, ownerId: e.target.value})} style={{padding:"10px", borderRadius:"6px", border:"1px solid #ddd"}}>
                          <option value="">Select Owner</option>
                          {owners.map(o => <option key={o.id} value={o.id}>{o.firstName} {o.lastName}</option>)}
                      </select>
                      {walkInData.ownerId && (
                           <select required value={walkInData.petId} onChange={e => {
                               const pet = allPets.find(p => p.id === e.target.value);
                               setWalkInData({...walkInData, petId: e.target.value, petName: pet?.name || ""});
                           }} style={{padding:"10px", borderRadius:"6px", border:"1px solid #ddd"}}>
                              <option value="">Select Pet</option>
                              {allPets.filter(p => p.ownerId === walkInData.ownerId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                           </select>
                      )}
                      <input type="date" required value={walkInData.date} onChange={e => setWalkInData({...walkInData, date: e.target.value})} style={{padding:"10px", borderRadius:"6px", border:"1px solid #ddd"}} />
                      <input type="time" required value={walkInData.time} onChange={e => setWalkInData({...walkInData, time: e.target.value})} style={{padding:"10px", borderRadius:"6px", border:"1px solid #ddd"}} />
                      <select required value={walkInData.reason} onChange={e => setWalkInData({...walkInData, reason: e.target.value})} style={{padding:"10px", borderRadius:"6px", border:"1px solid #ddd"}}>
                          <option value="">Select Reason</option>
                          {VISIT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <div style={{display:"flex", gap:"10px", marginTop:"10px"}}>
                          <button type="submit" style={{flex:1, background:"#2196F3", color:"white", border:"none", padding:"10px", borderRadius:"6px", cursor:"pointer"}}>Book</button>
                          <button type="button" onClick={() => setShowWalkInModal(false)} style={{flex:1, background:"#ccc", border:"none", padding:"10px", borderRadius:"6px", cursor:"pointer"}}>Cancel</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* 2. Consultation Modal */}
      {showConsultModal && (
          <div className="modal-overlay" style={{position:"fixed", top:0, left:0, width:"100%", height:"100%", background:"rgba(0,0,0,0.5)", display:"flex", justifyContent:"center", alignItems:"center", zIndex:2000}}>
              <div style={{background:"white", padding:"25px", borderRadius:"12px", width:"600px", maxWidth:"95%", maxHeight:"90vh", overflowY:"auto"}}>
                  <h3 style={{marginTop:0, color:"#2196F3"}}>Consultation Form</h3>
                  <form onSubmit={handleFinishConsultation} style={{display:"flex", flexDirection:"column", gap:"15px"}}>
                      <div style={{display:"flex", gap:"15px"}}>
                          <label style={{flex:1}}><strong>Date:</strong><br/><input type="date" value={consultData.date} onChange={e => setConsultData({...consultData, date: e.target.value})} style={{width:"100%", padding:"8px", marginTop:"5px"}} /></label>
                          <label style={{flex:1}}><strong>Reason:</strong><br/><input type="text" value={consultData.reason} readOnly style={{width:"100%", padding:"8px", marginTop:"5px", background:"#f5f5f5"}} /></label>
                      </div>
                      
                      <div>
                          <strong>Symptoms:</strong>
                          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"5px", maxHeight:"100px", overflowY:"auto", border:"1px solid #ddd", padding:"10px", marginTop:"5px", borderRadius:"6px"}}>
                              {SYMPTOM_OPTIONS.map(sym => (
                                  <label key={sym} style={{display:"flex", alignItems:"center", gap:"5px", fontSize:"13px"}}>
                                      <input type="checkbox" checked={consultData.symptoms.includes(sym)} onChange={() => handleSymptomChange(sym)} /> {sym}
                                  </label>
                              ))}
                          </div>
                      </div>

                      <label><strong>Diagnosis:</strong><br/>
                        <input list="diagnosis-options" value={consultData.diagnosis} onChange={e => setConsultData({...consultData, diagnosis: e.target.value})} placeholder="Select or Type Diagnosis" style={{width:"100%", padding:"8px", marginTop:"5px", borderRadius:"6px", border:"1px solid #ddd"}} />
                        <datalist id="diagnosis-options">{DIAGNOSIS_OPTIONS.map(d => <option key={d} value={d} />)}</datalist>
                      </label>

                      <label><strong>Treatment / Medicine:</strong><br/>
                        <textarea value={consultData.medicine} onChange={e => setConsultData({...consultData, medicine: e.target.value})} rows="2" style={{width:"100%", padding:"8px", marginTop:"5px", borderRadius:"6px", border:"1px solid #ddd"}} placeholder="Prescribed meds or procedures..." />
                      </label>

                      <label><strong>Notes:</strong><br/>
                        <textarea value={consultData.notes} onChange={e => setConsultData({...consultData, notes: e.target.value})} rows="2" style={{width:"100%", padding:"8px", marginTop:"5px", borderRadius:"6px", border:"1px solid #ddd"}} placeholder="Additional observations..." />
                      </label>

                      <label style={{background:"#e3f2fd", padding:"10px", borderRadius:"6px"}}>
                          <strong>Schedule Follow-up (Optional):</strong><br/>
                          <input type="date" value={consultData.followUp} onChange={e => setConsultData({...consultData, followUp: e.target.value})} style={{width:"100%", padding:"8px", marginTop:"5px", borderRadius:"6px", border:"1px solid #bbb"}} />
                      </label>

                      <div style={{display:"flex", gap:"10px", marginTop:"10px"}}>
                          <button type="submit" style={{flex:1, background:"#4CAF50", color:"white", border:"none", padding:"12px", borderRadius:"6px", cursor:"pointer", fontWeight:"bold"}}>Finish Consultation</button>
                          <button type="button" onClick={() => setShowConsultModal(false)} style={{flex:1, background:"#ccc", border:"none", padding:"12px", borderRadius:"6px", cursor:"pointer"}}>Cancel</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* 3. Inventory Add/Edit Modal */}
      {showInventoryModal && (
          <div className="modal-overlay" style={{position:"fixed", top:0, left:0, width:"100%", height:"100%", background:"rgba(0,0,0,0.5)", display:"flex", justifyContent:"center", alignItems:"center", zIndex:2000}}>
              <div style={{background:"white", padding:"25px", borderRadius:"12px", width:"400px"}}>
                  <h3 style={{marginTop:0}}>{editingInventoryId ? "Edit Item" : "Add New Item"}</h3>
                  <form onSubmit={handleSaveInventory} style={{display:"flex", flexDirection:"column", gap:"15px"}}>
                      <input type="text" required placeholder="Item Name" value={inventoryData.name} onChange={e => setInventoryData({...inventoryData, name: e.target.value})} style={{padding:"10px", borderRadius:"6px", border:"1px solid #ddd"}} />
                      <select required value={inventoryData.category} onChange={e => setInventoryData({...inventoryData, category: e.target.value})} style={{padding:"10px", borderRadius:"6px", border:"1px solid #ddd"}}>
                          <option value="">Select Category</option>
                          {INVENTORY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <div style={{display:"flex", gap:"10px"}}>
                          <input type="number" required placeholder="Qty" value={inventoryData.quantity} onChange={e => setInventoryData({...inventoryData, quantity: Number(e.target.value)})} style={{flex:1, padding:"10px", borderRadius:"6px", border:"1px solid #ddd"}} />
                          <select value={inventoryData.unit} onChange={e => setInventoryData({...inventoryData, unit: e.target.value})} style={{width:"80px", padding:"10px", borderRadius:"6px", border:"1px solid #ddd"}}>
                              {INVENTORY_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                      </div>
                      <label style={{fontSize:"13px", color:"#666"}}>Expiry Date (Optional):
                          <input type="date" value={inventoryData.expiryDate} onChange={e => setInventoryData({...inventoryData, expiryDate: e.target.value})} style={{width:"100%", padding:"10px", marginTop:"5px", borderRadius:"6px", border:"1px solid #ddd"}} />
                      </label>
                      <label style={{fontSize:"13px", color:"#666"}}>Low Stock Threshold:
                          <input type="number" value={inventoryData.threshold} onChange={e => setInventoryData({...inventoryData, threshold: Number(e.target.value)})} style={{width:"100%", padding:"10px", marginTop:"5px", borderRadius:"6px", border:"1px solid #ddd"}} />
                      </label>
                      <div style={{display:"flex", gap:"10px", marginTop:"10px"}}>
                          <button type="submit" style={{flex:1, background:"#2196F3", color:"white", border:"none", padding:"10px", borderRadius:"6px", cursor:"pointer"}}>{editingInventoryId ? "Update" : "Add"}</button>
                          <button type="button" onClick={() => setShowInventoryModal(false)} style={{flex:1, background:"#ccc", border:"none", padding:"10px", borderRadius:"6px", cursor:"pointer"}}>Cancel</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* 4. Report Details Modal */}
      {reportDetailModal && (
          <div className="modal-overlay" style={{position:"fixed", top:0, left:0, width:"100%", height:"100%", background:"rgba(0,0,0,0.5)", display:"flex", justifyContent:"center", alignItems:"center", zIndex:2000}}>
              <div style={{background:"white", padding:"25px", borderRadius:"12px", width:"600px", maxHeight:"80vh", overflowY:"auto"}}>
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px"}}>
                      <h3 style={{margin:0}}>{reportDetailModal.title}</h3>
                      <button onClick={() => setReportDetailModal(null)} style={{background:"none", border:"none", fontSize:"20px", cursor:"pointer"}}>✕</button>
                  </div>
                  <table style={{width:"100%", borderCollapse:"collapse", fontSize:"14px"}}>
                      <thead>
                          <tr style={{background:"#f5f5f5", textAlign:"left"}}>
                              <th style={{padding:"8px"}}>Date / Name</th>
                              <th style={{padding:"8px"}}>Details</th>
                              {(reportDetailModal.type === 'added' || reportDetailModal.type === 'used') && <th style={{padding:"8px"}}>Qty</th>}
                          </tr>
                      </thead>
                      <tbody>
                          {reportDetailModal.data.length === 0 ? <tr><td colSpan="3" style={{padding:"20px", textAlign:"center", color:"#999"}}>No data found</td></tr> : 
                           reportDetailModal.data.map((item, i) => (
                               <tr key={i} style={{borderBottom:"1px solid #eee"}}>
                                   <td style={{padding:"8px"}}>
                                       {reportDetailModal.type.includes('appointments') ? item.date : (item.date ? item.date.toLocaleDateString() : item.name)}
                                   </td>
                                   <td style={{padding:"8px"}}>
                                       {reportDetailModal.type.includes('appointments') ? `${item.petName} (${item.reason})` : (item.itemName || item.category)}
                                       {item.reason && <div style={{fontSize:"11px", color:"#777"}}>{item.reason}</div>}
                                   </td>
                                   {(reportDetailModal.type === 'added' || reportDetailModal.type === 'used') && (
                                       <td style={{padding:"8px", fontWeight:"bold"}}>{item.change ? Math.abs(item.change) : item.qty}</td>
                                   )}
                               </tr>
                           ))
                          }
                      </tbody>
                  </table>
                  <div style={{marginTop:"20px", textAlign:"right"}}>
                       <button onClick={() => setReportDetailModal(null)} style={{background:"#ccc", border:"none", padding:"8px 15px", borderRadius:"6px", cursor:"pointer"}}>Close</button>
                  </div>
              </div>
          </div>
      )}

      {/* 5. Quick Usage Modal */}
      {usageModal.show && (
          <div className="modal-overlay" style={{position:"fixed", top:0, left:0, width:"100%", height:"100%", background:"rgba(0,0,0,0.5)", display:"flex", justifyContent:"center", alignItems:"center", zIndex:2100}}>
              <div style={{background:"white", padding:"20px", borderRadius:"12px", width:"300px", textAlign:"center", boxShadow: "0 4px 20px rgba(0,0,0,0.2)"}}>
                  <h3 style={{margin: "0 0 15px 0", color: "#333"}}>Quick Use: {usageModal.item?.name}</h3>
                  <div style={{marginBottom:"20px"}}>
                      <label style={{display:"block", marginBottom:"5px", color:"#666"}}>Quantity to use:</label>
                      <input type="number" min="1" value={usageModal.qty} onChange={(e) => setUsageModal({ ...usageModal, qty: parseInt(e.target.value) })} style={{padding: "8px", width: "60px", textAlign: "center", fontSize: "16px", border: "1px solid #ccc", borderRadius: "4px"}} />
                      <span style={{marginLeft:"10px", color:"#555"}}>{usageModal.item?.unit}</span>
                  </div>
                  <div style={{display: "flex", justifyContent: "center", gap: "10px"}}>
                      <button onClick={() => setUsageModal({ show: false, item: null, qty: 1 })} style={{padding: "8px 15px", background: "#e0e0e0", color: "#333", border: "none", borderRadius: "6px", cursor: "pointer"}}>Cancel</button>
                      <button onClick={confirmQuickUsage} style={{padding: "8px 15px", background: "#FF9800", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold"}}>Confirm</button>
                  </div>
              </div>
          </div>
      )}

      {/* 6. Custom Confirmation Modal */}
      {confirmModal.show && (
          <div className="modal-overlay" style={{position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 3000}}>
              <div style={{
                  background: "white", padding: "25px", borderRadius: "12px", width: "350px", textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.2)"
              }}>
                  <h3 style={{margin: "0 0 15px 0", color: "#333"}}>Confirmation</h3>
                  <p style={{marginBottom: "25px", fontSize: "16px", color: "#666"}}>{confirmModal.message}</p>
                  
                  <div style={{display: "flex", justifyContent: "center", gap: "15px"}}>
                      <button 
                          onClick={() => setConfirmModal({ ...confirmModal, show: false })} 
                          style={{
                              padding: "10px 20px", background: "#e0e0e0", color: "#333", 
                              border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold"
                          }}
                      >
                          Cancel
                      </button>
                      <button 
                          onClick={() => { confirmModal.onConfirm(); setConfirmModal({ ...confirmModal, show: false }); }} 
                          style={{
                              padding: "10px 20px", background: "#f44336", color: "white", 
                              border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold"
                          }}
                      >
                          Yes
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* 7. Decline Reason Modal */}
      {declineModal.show && (
          <div className="modal-overlay" style={{position:"fixed", top:0, left:0, width:"100%", height:"100%", background:"rgba(0,0,0,0.5)", display:"flex", justifyContent:"center", alignItems:"center", zIndex:3000}}>
              <div style={{background:"white", padding:"25px", borderRadius:"12px", width:"400px", maxWidth:"90%"}}>
                  <h3 style={{marginTop:0, color:"#d32f2f"}}>Decline Appointment</h3>
                  <p style={{fontSize:"14px", color:"#666"}}>Please provide a reason for the owner:</p>
                  <textarea 
                      value={declineModal.reason} 
                      onChange={(e) => setDeclineModal({...declineModal, reason: e.target.value})}
                      placeholder="e.g. Time slot unavailable, Doctor is out..."
                      rows="3"
                      style={{width:"100%", padding:"10px", borderRadius:"6px", border:"1px solid #ddd", marginBottom:"15px", boxSizing:"border-box"}}
                  />
                  <div style={{display:"flex", gap:"10px"}}>
                      <button onClick={handleConfirmDecline} style={{flex:1, background:"#f44336", color:"white", border:"none", padding:"10px", borderRadius:"6px", cursor:"pointer", fontWeight:"bold"}}>Decline Request</button>
                      <button onClick={() => setDeclineModal({ ...declineModal, show: false })} style={{flex:1, background:"#ccc", border:"none", padding:"10px", borderRadius:"6px", cursor:"pointer"}}>Cancel</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default StaffDashboard;
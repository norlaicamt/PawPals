import { useEffect, useState } from "react";
import { auth, db } from "./firebase";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import logoImg from "./assets/logo.png"; 
import { collection, onSnapshot, doc, query, orderBy, updateDoc, deleteDoc, getDoc, addDoc } from "firebase/firestore";


// --- PROFESSIONAL SVG BAR CHART COMPONENT ---
const SimpleBarChart = ({ data, title }) => {
    const height = 300; 
    const width = 400; 
    const padding = 40;
    const chartWidth = width - (padding * 2);
    const chartHeight = height - (padding * 2);
    
    const maxValue = Math.max(...data.map(d => d.value), 1);
    const gap = (chartWidth / data.length) * 0.4; 
    const barWidth = (chartWidth / data.length) * 0.6;

    const [hoverIndex, setHoverIndex] = useState(null);

    return (
        <div className="no-print" style={{ background: "white", padding: "15px", borderRadius: "12px", height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", border: "1px solid #eee" }}>
            <h4 style={{ margin: "0 0 10px 0", color: "#333", borderBottom:"1px solid #f0f0f0", paddingBottom:"10px", fontSize: "16px", textAlign: "center" }}>📊 {title}</h4>
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", maxHeight: "100%" }}>
                    {[0, 0.25, 0.5, 0.75, 1].map((tick, i) => {
                        const y = padding + chartHeight - (chartHeight * tick);
                        return (
                            <g key={i}>
                                <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#eee" strokeWidth="1" strokeDasharray="4" />
                                <text x={padding - 10} y={y + 4} textAnchor="end" fontSize="10" fill="#999">{Math.round(maxValue * tick)}</text>
                            </g>
                        );
                    })}
                    {data.map((d, i) => {
                        const barH = (d.value / maxValue) * chartHeight;
                        const x = padding + (i * (chartWidth / data.length)) + (gap / 2);
                        const y = padding + (chartHeight - barH);
                        return (
                            <g key={i} onMouseEnter={() => setHoverIndex(i)} onMouseLeave={() => setHoverIndex(null)}>
                                <rect 
                                    x={x} y={y} width={barWidth} height={barH} 
                                    fill={hoverIndex === i ? "#1976D2" : (d.color || "#2196F3")} 
                                    rx="4" style={{ transition: "all 0.2s" }}
                                />
                                <text x={x + barWidth / 2} y={y - 5} textAnchor="middle" fontSize="11" fontWeight="bold" fill="#333">{d.value}</text>
                                <text 
                                    x={x + barWidth / 2} y={height - padding + 15} textAnchor="end" fontSize="10" 
                                    fill={hoverIndex === i ? "#000" : "#666"}
                                    transform={`rotate(-45, ${x + barWidth / 2}, ${height - padding + 15})`}
                                >
                                    {d.label.length > 8 ? d.label.substring(0, 6) + "..." : d.label}
                                </text>
                            </g>
                        );
                    })}
                    <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#ccc" strokeWidth="1" />
                    <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#ccc" strokeWidth="1" />
                </svg>
            </div>
        </div>
    );
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  
  // --- DATABASE DATA STATES ---
  const [users, setUsers] = useState([]);
  const [pets, setPets] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [archivedPets, setArchivedPets] = useState([]);
  const [requests, setRequests] = useState([]); 

  // --- UI STATES ---
  const [activeView, setActiveView] = useState("overview"); 
  const [userTab, setUserTab] = useState("owner");
  const [userSearch, setUserSearch] = useState("");
  const [petSearch, setPetSearch] = useState("");
  const [speciesFilter, setSpeciesFilter] = useState("All");
  
  // Records Tab
  const [recordTab, setRecordTab] = useState("pets");
  const [recordPetSearch, setRecordPetSearch] = useState(""); 
  const [recordStatus, setRecordStatus] = useState("All");
  const [recordServiceFilter, setRecordServiceFilter] = useState("All");

  // Archive Tab (NEW SUB-TABS)
  const [archiveTab, setArchiveTab] = useState("requests"); // Default to requests

  // Detailed Record View
  const [viewingRecord, setViewingRecord] = useState(null);

  // Edit User
  const [editingUser, setEditingUser] = useState(null);
  const [editFormData, setEditFormData] = useState({ firstName: "", lastName: "" });

  // PRINT STATES
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedPetsForPrint, setSelectedPetsForPrint] = useState([]);
  const [isPrintingAppointments, setIsPrintingAppointments] = useState(false);

  // CUSTOM MODAL STATE
  const [modal, setModal] = useState({
      show: false,
      title: "",
      message: "",
      type: "confirm", 
      onConfirm: null 
  });

  // --- DATA FETCHING ---
  useEffect(() => {
      const unsubUsers = onSnapshot(collection(db, "users"), (snap) => setUsers(snap.docs.map(d => ({...d.data(), id: d.id}))));
      const unsubPets = onSnapshot(collection(db, "pets"), (snap) => {
          const allPets = snap.docs.map(d => ({...d.data(), id: d.id}));
          setPets(allPets.filter(p => !p.isArchived && p.deletionStatus !== "Pending"));
          setArchivedPets(allPets.filter(p => p.isArchived || p.deletionStatus === "Pending"));
      });
      const unsubAppts = onSnapshot(query(collection(db, "appointments"), orderBy("date", "desc")), (snap) => setAppointments(snap.docs.map(d => ({...d.data(), id: d.id}))));
      
      const unsubRequests = onSnapshot(collection(db, "edit_requests"), (snap) => {
        setRequests(snap.docs.map(d => ({ ...d.data(), id: d.id })));
      });

      return () => { unsubUsers(); unsubPets(); unsubAppts(); unsubRequests(); };
  }, []);

  // Stats for Overview
  const stats = {
    totalOwners: users.filter(u => u.role === "owner" && !u.isDisabled).length,
    totalPets: pets.length,
    totalAppointments: appointments.length,
    pendingDeletions: archivedPets.filter(p => p.deletionStatus === "Pending").length,
    completedAppointments: appointments.filter(a => a.status === "Done").length
  };

  // --- ACTION HANDLERS ---
  const closeModal = () => setModal({ ...modal, show: false });
  const confirmAction = (title, message, action) => { setModal({ show: true, title, message, type: "confirm", onConfirm: action }); };
  const showAlert = (title, message) => { setModal({ show: true, title, message, type: "alert", onConfirm: null }); };

  const handleLogout = () => { 
      confirmAction("Logout", "Are you sure you want to log out?", async () => { await signOut(auth); navigate("/"); });
  };

  const handleToggleUserStatus = (userId, currentStatus) => {
      const newStatus = !currentStatus; 
      const action = newStatus ? "Disable" : "Enable";
      confirmAction(`${action} Account`, `Are you sure you want to ${action} this account?`, async () => {
          await updateDoc(doc(db, "users", userId), { isDisabled: newStatus });
          closeModal();
      });
  };

  const handleManualArchive = (id) => { 
      confirmAction("Archive Pet", "Are you sure you want to archive this pet?", async () => {
          await updateDoc(doc(db, "pets", id), { isArchived: true });
          closeModal();
      });
  };

  const handleApproveDeletion = (pet) => { 
      confirmAction("Approve Deletion", "This will permanently archive the pet. Continue?", async () => {
          await updateDoc(doc(db, "pets", pet.id), { isArchived: true, deletionStatus: "Approved" });
          closeModal();
      });
  };

  const handleRejectDeletion = (petId) => { 
      confirmAction("Reject Request", "This will restore the pet to the active list. Continue?", async () => {
          await updateDoc(doc(db, "pets", petId), { isArchived: false, deletionStatus: null, deletionReason: null });
          closeModal();
      });
  };

  const handleRestorePet = (id) => { 
      confirmAction("Restore Pet", "Restore this pet to the active list?", async () => {
          await updateDoc(doc(db, "pets", id), { isArchived: false, deletionStatus: null, deletionReason: null });
          closeModal();
      });
  };

// --- UPDATED HANDLERS ---
  const handleApproveRequest = async (req) => {
    confirmAction("Approve Update", "Approve these changes to the pet record?", async () => {
        try {
            const petRef = doc(db, "pets", req.petId);
            const petSnap = await getDoc(petRef);
            
            if (!petSnap.exists()) {
                alert("Pet no longer exists.");
                await deleteDoc(doc(db, "edit_requests", req.id));
                return;
            }

            // 1. Update the pet data
            await updateDoc(petRef, req.newData);
            
            // 2. Delete the request
            await deleteDoc(doc(db, "edit_requests", req.id));
            
            // 3. SEND NOTIFICATION TO OWNER
            await addDoc(collection(db, "notifications"), {
                ownerId: req.ownerId, 
                title: "Update Approved",
                message: `Your request to update ${req.petName} has been approved.`,
                type: "success", // Green color
                isRead: false,
                createdAt: new Date()
            });

            closeModal();
            showAlert("Success", "Pet updated and owner notified.");
        } catch (error) {
            console.error(error);
            showAlert("Error", "Failed to update pet information.");
        }
    });
  };

  const handleRejectRequest = async (req) => { 
    // NOTE: This function now accepts the full 'req' object, not just 'req.id'
    confirmAction("Reject Update", "Reject this edit request? This cannot be undone.", async () => {
        try {
            // 1. Delete the request
            await deleteDoc(doc(db, "edit_requests", req.id));

            // 2. SEND NOTIFICATION TO OWNER
            await addDoc(collection(db, "notifications"), {
                ownerId: req.ownerId,
                title: "Update Rejected",
                message: `Your request to update ${req.petName} has been declined.`,
                type: "error", // Red color
                isRead: false,
                createdAt: new Date()
            });

            closeModal();
            showAlert("Rejected", "Request removed and owner notified.");
        } catch (error) {
            console.error(error);
        }
    });
  };

  const handleEditUser = (user) => { setEditingUser(user); setEditFormData({ firstName: user.firstName, lastName: user.lastName }); };
  
  const handleSaveUser = async (e) => {
      e.preventDefault();
      if(editingUser) {
          await updateDoc(doc(db, "users", editingUser.id), { firstName: editFormData.firstName, lastName: editFormData.lastName });
          setEditingUser(null);
          showAlert("Success", "User details updated successfully!");
      }
  };

  // --- PRINT LOGIC ---
  const togglePetSelection = (petId) => {
      setSelectedPetsForPrint(prev => 
          prev.includes(petId) ? prev.filter(id => id !== petId) : [...prev, petId]
      );
  };

  const handleSelectAllForPrint = () => {
      const currentPets = pets.sort((a, b) => a.name.localeCompare(b.name));
      if (selectedPetsForPrint.length === currentPets.length) {
          setSelectedPetsForPrint([]); 
      } else {
          setSelectedPetsForPrint(currentPets.map(p => p.id)); 
      }
  };

  const handlePrintButtonClick = () => {
      if (recordTab === "pets") {
          setIsPrintingAppointments(false);
          setSelectedPetsForPrint([]); 
          setShowPrintModal(true);
      } else {
          setIsPrintingAppointments(true);
          setTimeout(() => { window.print(); }, 300);
      }
  };

  const executePrint = () => {
      setShowPrintModal(false);
      setTimeout(() => { window.print(); }, 500);
  };

  // --- FILTERS & CALCULATIONS ---
  const uniqueServices = [...new Set(appointments.map(a => a.reason).filter(Boolean))].sort();

  const getFilteredUsers = () => {
      let filtered = users.filter(u => 
        (u.firstName?.toLowerCase().includes(userSearch.toLowerCase()) || 
         u.lastName?.toLowerCase().includes(userSearch.toLowerCase()) || 
         u.email?.toLowerCase().includes(userSearch.toLowerCase()))
      );

      if (userTab === "disabled") {
          return filtered.filter(u => u.isDisabled === true);
      } else if (userTab === "staff_admin") {
          return filtered.filter(u => (u.role === "admin" || u.role === "staff") && !u.isDisabled);
      } else {
          return filtered.filter(u => u.role === userTab && !u.isDisabled);
      }
  };

  const filteredPets = pets.filter(p => {
    const matchesSearch = (p.name.toLowerCase().includes(petSearch.toLowerCase()) || 
        users.find(u=>u.id===p.ownerId)?.firstName.toLowerCase().includes(petSearch.toLowerCase()));
    let matchesSpecies = true;
    if (speciesFilter === "All") matchesSpecies = true;
    else if (speciesFilter === "Other") matchesSpecies = p.species !== "Dog" && p.species !== "Cat";
    else matchesSpecies = p.species === speciesFilter;
    return matchesSearch && matchesSpecies;
  });

  const sortedPetsForRecords = [...pets]
    .filter(p => p.name.toLowerCase().includes(recordPetSearch.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const filteredAppointments = appointments.filter(a => {
      const matchStatus = recordStatus === "All" || a.status === recordStatus;
      const matchService = recordServiceFilter === "All" || a.reason === recordServiceFilter;
      return matchStatus && matchService;
  });

  const breedChartData = (() => {
      const counts = {};
      pets.forEach(p => { const b = p.breed || "Unknown"; counts[b] = (counts[b] || 0) + 1; });
      return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value }));
  })();

  const getTabStyle = (name) => ({
      padding: "15px", fontSize: "1.1rem", cursor: "pointer", border: "none", borderRadius: "12px",
      background: activeView === name ? "#2196F3" : "white", color: activeView === name ? "white" : "#555",
      boxShadow: activeView === name ? "0 4px 10px rgba(33, 150, 243, 0.4)" : "0 2px 4px rgba(0,0,0,0.05)",
      fontWeight: "bold", transition: "all 0.2s", width: "100%", textAlign: "center"
  });

  return (
    <div className="dashboard-container" style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f5f5" }}>
      <nav className="navbar no-print" style={{ flexShrink: 0, background: "white", padding: "15px 30px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #eee" }}>
        <div className="logo" style={{display: "flex", alignItems: "center", gap: "10px", fontWeight: "bold", fontSize: "1.2rem", color: "#2196F3"}}>
            <img src={logoImg} alt="PawPals" className="logo-img" style={{height: "35px"}} /> PawPals Admin
        </div>
        <button onClick={handleLogout} className="action-btn" style={{background: "#ffebee", color: "#d32f2f", border: "none", padding: "10px 20px", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", transition: "0.2s"}}>Logout</button>
      </nav>

      <main className="main-content" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "20px", maxWidth: "1200px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        
        {/* Navigation Tabs */}
        <div className="no-print" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "15px", marginBottom: "20px", flexShrink: 0 }}>
          <button style={getTabStyle("overview")} onClick={() => setActiveView("overview")}>Overview</button>
          <button style={getTabStyle("accounts")} onClick={() => setActiveView("accounts")}>Accounts</button>
          <button style={getTabStyle("pets")} onClick={() => setActiveView("pets")}>Pets List</button>
          <button style={getTabStyle("records")} onClick={() => setActiveView("records")}>Records</button>
          
          <button style={getTabStyle("archive")} onClick={() => setActiveView("archive")}>
            Archive / Requests
            {(stats.pendingDeletions > 0 || requests.length > 0) && (
                <span style={{background:"red", color:"white", borderRadius:"50%", padding:"2px 6px", fontSize:"10px", verticalAlign:"middle", marginLeft:"8px"}}>
                    {stats.pendingDeletions + requests.length}
                </span>
            )}
          </button>
        </div>

        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          
          {/* --- OVERVIEW VIEW --- */}
          {activeView === "overview" && (
            <div className="no-print" style={{ display: "flex", flexDirection: "column", gap: "20px", height: "100%", overflowY: "auto", paddingRight: "5px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px" }}>
                    <div className="card" style={{ background: "white", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", padding: "20px", borderLeft: "5px solid #2196F3", display: "flex", flexDirection: "column" }}>
                        <span style={{ color: "#666", fontSize: "14px", fontWeight: "bold" }}>Total Registered Owners</span>
                        <span style={{ fontSize: "28px", fontWeight: "bold", marginTop: "5px" }}>{stats.totalOwners}</span>
                    </div>
                    <div className="card" style={{ background: "white", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", padding: "20px", borderLeft: "5px solid #4CAF50", display: "flex", flexDirection: "column" }}>
                        <span style={{ color: "#666", fontSize: "14px", fontWeight: "bold" }}>Total Active Pets</span>
                        <span style={{ fontSize: "28px", fontWeight: "bold", marginTop: "5px" }}>{stats.totalPets}</span>
                    </div>
                    <div className="card" style={{ background: "white", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", padding: "20px", borderLeft: "5px solid #9C27B0", display: "flex", flexDirection: "column" }}>
                        <span style={{ color: "#666", fontSize: "14px", fontWeight: "bold" }}>Total Appointments</span>
                        <span style={{ fontSize: "28px", fontWeight: "bold", marginTop: "5px" }}>{stats.totalAppointments}</span>
                    </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", flex: 1, minHeight: "350px" }}>
                    <div style={{background: "white", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", overflow: "hidden"}}>
                        <SimpleBarChart data={breedChartData} title="Pet Breed Distribution" />
                    </div>
                    <div className="card" style={{ background: "white", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", padding: "20px", display: "flex", flexDirection: "column" }}>
                        <h4 style={{ margin: "0 0 15px 0", borderBottom: "1px solid #eee", paddingBottom: "10px", color: "#333" }}>System Quick Stats</h4>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "12px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "15px", background: "#f9f9f9", borderRadius: "8px", border: "1px solid #eee" }}>
                                <span>Pending Edit Requests</span>
                                <b style={{ color: requests.length > 0 ? "orange" : "#333" }}>{requests.length}</b>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "15px", background: "#f9f9f9", borderRadius: "8px", border: "1px solid #eee" }}>
                                <span>Pending Deletions</span>
                                <b style={{ color: stats.pendingDeletions > 0 ? "red" : "#333" }}>{stats.pendingDeletions}</b>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "15px", background: "#f9f9f9", borderRadius: "8px", border: "1px solid #eee" }}>
                                <span>Completed Appointments</span>
                                <b style={{ color: "#4CAF50" }}>{stats.completedAppointments}</b>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
          )}

          {/* --- ACCOUNTS VIEW --- */}
          {activeView === "accounts" && (
            <div className="card no-print" style={{ background: "white", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", height: "100%", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "20px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button onClick={() => setUserTab("owner")} style={{ padding: "8px 16px", borderRadius: "20px", border: "none", background: userTab === "owner" ? "#2196F3" : "#f1f1f1", color: userTab === "owner" ? "white" : "#666", cursor: "pointer", fontWeight: "bold" }}>Pet Owners</button>
                  <button onClick={() => setUserTab("staff_admin")} style={{ padding: "8px 16px", borderRadius: "20px", border: "none", background: userTab === "staff_admin" ? "#2196F3" : "#f1f1f1", color: userTab === "admin" ? "white" : "#666", cursor: "pointer", fontWeight: "bold" }}>Staff/Admin</button>
                  <button onClick={() => setUserTab("disabled")} style={{ padding: "8px 16px", borderRadius: "20px", border: "none", background: userTab === "disabled" ? "#d32f2f" : "#ffebee", color: userTab === "disabled" ? "white" : "#d32f2f", cursor: "pointer", fontWeight: "bold" }}>Disabled</button>
                </div>
                <input type="text" placeholder="Search accounts..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} className="search-input" style={{ width: "250px", padding: "10px", border: "1px solid #ddd", borderRadius: "8px", outline: "none" }} />
              </div>
              <div style={{ flex: 1, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead style={{ position: "sticky", top: 0, background: "white", boxShadow: "0 2px 5px rgba(0,0,0,0.05)" }}>
                    <tr style={{ textAlign: "left", color: "#666" }}>
                        <th style={{ padding: "15px" }}>Name</th>
                        <th style={{ padding: "15px" }}>Email</th>
                        <th style={{ padding: "15px" }}>Status</th>
                        <th style={{ padding: "15px" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredUsers().map(user => (
                      <tr key={user.id} style={{ borderBottom: "1px solid #f1f1f1" }}>
                        <td style={{ padding: "15px", fontWeight: "bold" }}>{user.firstName} {user.lastName}</td>
                        <td style={{ padding: "15px" }}>{user.email}</td>
                        <td style={{ padding: "15px" }}>
                          <span style={{ padding: "4px 10px", borderRadius: "12px", fontSize: "12px", background: user.isDisabled ? "#ffebee" : "#e8f5e9", color: user.isDisabled ? "#d32f2f" : "#2e7d32", fontWeight: "bold" }}>
                            {user.isDisabled ? "Disabled" : "Active"}
                          </span>
                        </td>
                        <td style={{ padding: "15px" }}>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button onClick={() => handleEditUser(user)} style={{ padding: "6px 12px", fontSize: "12px", background: "none", border: "1px solid #2196F3", color: "#2196F3", borderRadius: "6px", cursor: "pointer" }}>Edit</button>
                            <button onClick={() => handleToggleUserStatus(user.id, user.isDisabled)} style={{ padding: "6px 12px", fontSize: "12px", background: user.isDisabled ? "#4CAF50" : "#f44336", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}>
                              {user.isDisabled ? "Enable" : "Disable"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* --- PETS LIST VIEW --- */}
          {activeView === "pets" && (
            <div className="card no-print" style={{ background: "white", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", height: "100%", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "20px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <h3 style={{ margin: 0 }}>Active Pets</h3>
                  <select value={speciesFilter} onChange={(e) => setSpeciesFilter(e.target.value)} style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #ccc", marginLeft: "15px" }}>
                    <option value="All">All Species</option>
                    <option value="Dog">Dogs</option>
                    <option value="Cat">Cats</option>
                    <option value="Other">Others</option>
                  </select>
                </div>
                <input type="text" placeholder="Search pet or owner..." value={petSearch} onChange={(e) => setPetSearch(e.target.value)} className="search-input" style={{ width: "250px", padding: "10px", border: "1px solid #ddd", borderRadius: "8px", outline: "none" }} />
              </div>
              <div style={{ flex: 1, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead style={{ position: "sticky", top: 0, background: "white", boxShadow: "0 2px 5px rgba(0,0,0,0.05)" }}>
                    <tr style={{ textAlign: "left", color: "#666" }}>
                        <th style={{ padding: "15px" }}>Pet Name</th>
                        <th style={{ padding: "15px" }}>Species/Breed</th>
                        <th style={{ padding: "15px" }}>Owner</th>
                        <th style={{ padding: "15px" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPets.map(pet => (
                      <tr key={pet.id} style={{ borderBottom: "1px solid #f1f1f1" }}>
                        <td style={{ padding: "15px", fontWeight: "bold" }}>{pet.name}</td>
                        <td style={{ padding: "15px" }}>{pet.species} ({pet.breed})</td>
                        <td style={{ padding: "15px" }}>{users.find(u => u.id === pet.ownerId)?.firstName || "Unknown"}</td>
                        <td style={{ padding: "15px" }}>
                          <button onClick={() => handleManualArchive(pet.id)} style={{ padding: "6px 12px", background: "#eee", color: "#666", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>Archive</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* --- RECORDS VIEW --- */}
          {activeView === "records" && (
            <div className="card no-print" style={{ background: "white", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", height: "100%", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "20px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button onClick={() => setRecordTab("pets")} style={{ padding: "10px 20px", borderRadius: "20px", border: "none", background: recordTab === "pets" ? "#2196F3" : "#f5f5f5", color: recordTab === "pets" ? "white" : "#666", cursor: "pointer", fontWeight: "bold" }}>Pet History</button>
                  <button onClick={() => setRecordTab("appointments")} style={{ padding: "10px 20px", borderRadius: "20px", border: "none", background: recordTab === "appointments" ? "#2196F3" : "#f5f5f5", color: recordTab === "appointments" ? "white" : "#666", cursor: "pointer", fontWeight: "bold" }}>Appointment History</button>
                </div>
                <button onClick={handlePrintButtonClick} style={{ background: "#4CAF50", color: "white", padding: "10px 25px", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" }}>Print Report</button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
                {recordTab === "pets" ? (
                  <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "20px", height: "100%" }}>
                    {/* Left: Scrollable Alphabetical Pet List */}
                    <div style={{ background: "#f9f9f9", borderRadius: "12px", display: "flex", flexDirection: "column", overflow: "hidden", border: "1px solid #eee" }}>
                        <div style={{ padding: "15px", borderBottom: "1px solid #ddd" }}>
                            <input type="text" placeholder="Search pet name..." value={recordPetSearch} onChange={(e) => setRecordPetSearch(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ccc", boxSizing: "border-box" }} />
                        </div>
                        <div style={{ flex: 1, overflowY: "auto" }}>
                            {sortedPetsForRecords.map(pet => (
                                <div key={pet.id} onClick={() => setViewingRecord(pet)} style={{ padding: "15px", borderBottom: "1px solid #eee", cursor: "pointer", background: viewingRecord?.id === pet.id ? "#e3f2fd" : "transparent", transition: "0.2s" }}>
                                    <div style={{ fontWeight: "bold", color: "#333" }}>{pet.name}</div>
                                    <div style={{ fontSize: "12px", color: "#666" }}>Owner: {users.find(u => u.id === pet.ownerId)?.firstName}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    {/* Right: Selected Pet's History Card */}
                    <div style={{ background: "white", borderRadius: "12px", padding: "25px", border: "1px solid #eee", overflowY: "auto" }}>
                        {viewingRecord ? (
                            <div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", borderBottom: "2px solid #2196F3", paddingBottom: "15px" }}>
                                    <div>
                                        <h2 style={{ margin: 0, color: "#2196F3" }}>{viewingRecord.name}</h2>
                                        <p style={{ margin: "5px 0", color: "#666" }}>{viewingRecord.species} • {viewingRecord.breed} • {viewingRecord.gender}</p>
                                    </div>
                                    <div style={{ textAlign: "right", fontSize: "14px" }}>
                                        <div><b>Owner:</b> {users.find(u => u.id === viewingRecord.ownerId)?.firstName} {users.find(u => u.id === viewingRecord.ownerId)?.lastName}</div>
                                        <div><b>Contact:</b> {users.find(u => u.id === viewingRecord.ownerId)?.email}</div>
                                    </div>
                                </div>
                                <h3 style={{ borderBottom: "1px solid #eee", paddingBottom: "10px", marginBottom: "15px" }}>Medical History</h3>
                                {appointments.filter(a => a.petId === viewingRecord.id && a.status === "Done").length > 0 ? (
                                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                        <thead>
                                            <tr style={{ background: "#f5f5f5", color: "#333" }}>
                                                <th style={{ padding: "10px", textAlign: "left" }}>Date</th>
                                                <th style={{ padding: "10px", textAlign: "left" }}>Service</th>
                                                <th style={{ padding: "10px", textAlign: "left" }}>Notes</th>
                                                <th style={{ padding: "10px", textAlign: "left" }}>Vet</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {appointments.filter(a => a.petId === viewingRecord.id && a.status === "Done").map(appt => (
                                                <tr key={appt.id} style={{ borderBottom: "1px solid #eee" }}>
                                                    <td style={{ padding: "10px" }}>{appt.date}</td>
                                                    <td style={{ padding: "10px", fontWeight: "bold" }}>{appt.reason}</td>
                                                    <td style={{ padding: "10px", color: "#555" }}>{appt.notes || "No notes"}</td>
                                                    <td style={{ padding: "10px" }}>{appt.vetName || "Dr. Staff"}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <p style={{ color: "#777", fontStyle: "italic" }}>No completed appointments found for this pet.</p>
                                )}
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "#aaa" }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2zm0 18c4.41 0 8-3.59 8-8s-3.59-8-8-8-8 3.59-8 8 3.59 8 8 8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                <p>Select a pet to view their full medical history</p>
                            </div>
                        )}
                    </div>
                  </div>
                ) : (
                  <div style={{ background: "white", borderRadius: "12px", border: "1px solid #eee", overflow: "hidden" }}>
                      <div style={{ padding: "15px", background: "#f9f9f9", borderBottom: "1px solid #ddd", display: "flex", gap: "15px" }}>
                          <select value={recordStatus} onChange={(e) => setRecordStatus(e.target.value)} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}>
                              <option value="All">All Statuses</option>
                              <option value="Done">Completed</option>
                              <option value="Pending">Pending</option>
                              <option value="Cancelled">Cancelled</option>
                          </select>
                          <select value={recordServiceFilter} onChange={(e) => setRecordServiceFilter(e.target.value)} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}>
                              <option value="All">All Services</option>
                              {uniqueServices.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                      </div>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <thead>
                              <tr style={{ background: "#f5f5f5", color: "#333", textAlign: "left" }}>
                                  <th style={{ padding: "12px" }}>Date</th>
                                  <th style={{ padding: "12px" }}>Owner</th>
                                  <th style={{ padding: "12px" }}>Pet</th>
                                  <th style={{ padding: "12px" }}>Service</th>
                                  <th style={{ padding: "12px" }}>Status</th>
                              </tr>
                          </thead>
                          <tbody>
                              {filteredAppointments.map(appt => (
                                  <tr key={appt.id} style={{ borderBottom: "1px solid #eee" }}>
                                      <td style={{ padding: "12px" }}>{appt.date}</td>
                                      <td style={{ padding: "12px" }}>{users.find(u => u.id === appt.userId)?.firstName}</td>
                                      <td style={{ padding: "12px" }}>{pets.find(p => p.id === appt.petId)?.name || "Unknown"}</td>
                                      <td style={{ padding: "12px" }}>{appt.reason}</td>
                                      <td style={{ padding: "12px" }}>
                                          <span style={{ padding: "4px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "bold", 
                                              background: appt.status === "Done" ? "#e8f5e9" : appt.status === "Cancelled" ? "#ffebee" : "#fff3e0",
                                              color: appt.status === "Done" ? "#2e7d32" : appt.status === "Cancelled" ? "#c62828" : "#ef6c00" 
                                          }}>
                                              {appt.status}
                                          </span>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* --- ARCHIVE & REQUESTS VIEW --- */}
          {activeView === "archive" && (
            <div className="card no-print" style={{ background: "white", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", height: "100%", display: "flex", flexDirection: "column" }}>
              
              {/* SUB TABS FOR ARCHIVE */}
              <div style={{ padding: "20px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                <div style={{ display: "flex", gap: "10px" }}>
                    <button onClick={() => setArchiveTab("requests")} style={{ padding: "8px 20px", borderRadius: "20px", border: "none", background: archiveTab === "requests" ? "#2196F3" : "#f5f5f5", color: archiveTab === "requests" ? "white" : "#666", cursor: "pointer", fontWeight: "bold", position: "relative" }}>
                        Edit Requests
                        {requests.length > 0 && <span style={{marginLeft: "8px", background: "red", color: "white", padding: "2px 6px", borderRadius: "10px", fontSize: "11px"}}>{requests.length}</span>}
                    </button>
                    <button onClick={() => setArchiveTab("pets")} style={{ padding: "8px 20px", borderRadius: "20px", border: "none", background: archiveTab === "pets" ? "#2196F3" : "#f5f5f5", color: archiveTab === "pets" ? "white" : "#666", cursor: "pointer", fontWeight: "bold", position: "relative" }}>
                        Archived Pets
                        {stats.pendingDeletions > 0 && <span style={{marginLeft: "8px", background: "orange", color: "white", padding: "2px 6px", borderRadius: "10px", fontSize: "11px"}}>{stats.pendingDeletions}</span>}
                    </button>
                </div>
              </div>

              {/* CONTENT */}
              <div style={{ flex: 1, overflowY: "auto", padding: "0" }}>
                
                {/* SUB TAB 1: REQUESTS */}
                {archiveTab === "requests" && (
                     <div style={{ padding: "20px" }}>
                        {requests.length === 0 ? (
                            <div style={{ textAlign: "center", color: "#666", marginTop: "50px" }}>
                                <p>No pending edit requests.</p>
                            </div>
                        ) : (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
                                {requests.map(req => (
                                    <div key={req.id} style={{ border: "1px solid #eee", padding: "15px", borderRadius: "8px", background: "#fff", boxShadow: "0 2px 5px rgba(0,0,0,0.05)" }}>
                                        <div style={{display: "flex", justifyContent: "space-between", marginBottom: "10px", alignItems: "center"}}>
                                            <strong style={{color: "#2196F3"}}>{req.petName}</strong>
                                            <span style={{fontSize: "11px", color: "#666"}}>{new Date(req.createdAt?.seconds * 1000).toLocaleDateString()}</span>
                                        </div>
                                        
                                        <div style={{background: "#f9f9f9", padding: "12px", borderRadius: "6px", marginBottom: "15px", fontSize: "13px"}}>
                                            <p style={{margin: "0 0 8px"}}><strong>Reason:</strong> {req.reason}</p>
                                            <div style={{borderTop: "1px solid #eee", paddingTop: "8px"}}>
                                                {Object.keys(req.newData).map(key => (
                                                    req.originalData[key] !== req.newData[key] && (
                                                        <div key={key} style={{marginBottom: "4px"}}>
                                                            <span style={{textTransform: "capitalize", fontWeight: "bold"}}>{key}:</span>{" "}
                                                            <span style={{color: "red", textDecoration: "line-through", marginRight: "5px"}}>{req.originalData[key]}</span>
                                                            → <span style={{color: "green", fontWeight: "bold"}}>{req.newData[key]}</span>
                                                        </div>
                                                    )
                                                ))}
                                            </div>
                                        </div>

                                        <div style={{ display: "flex", gap: "10px" }}>
                                            <button 
                                                onClick={() => handleRejectRequest(req)}
                                                style={{ flex: 1, background: "#ffebee", color: "#d32f2f", border: "none", padding: "8px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
                                            >
                                                Reject
                                            </button>
                                            <button 
                                                onClick={() => handleApproveRequest(req)}
                                                style={{ flex: 1, background: "#e8f5e9", color: "#2e7d32", border: "none", padding: "8px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
                                            >
                                                Approve
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                     </div>
                )}

                {/* SUB TAB 2: ARCHIVED PETS */}
                {archiveTab === "pets" && (
                    <div style={{ }}>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead style={{ position: "sticky", top: 0, background: "white", boxShadow: "0 2px 5px rgba(0,0,0,0.05)" }}>
                                <tr style={{ textAlign: "left", color: "#666" }}>
                                    <th style={{ padding: "15px" }}>Pet Name</th>
                                    <th style={{ padding: "15px" }}>Owner</th>
                                    <th style={{ padding: "15px" }}>Status</th>
                                    <th style={{ padding: "15px" }}>Reason</th>
                                    <th style={{ padding: "15px" }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {archivedPets.length === 0 ? (
                                    <tr><td colSpan="5" style={{padding:"20px", textAlign:"center", color: "#666"}}>No archived pets or deletion requests.</td></tr>
                                ) : (
                                    archivedPets.map(pet => (
                                    <tr key={pet.id} style={{ borderBottom: "1px solid #f1f1f1", background: pet.deletionStatus === "Pending" ? "#fff8e1" : "transparent" }}>
                                        <td style={{ padding: "15px", fontWeight: "bold" }}>{pet.name}</td>
                                        <td style={{ padding: "15px" }}>{users.find(u => u.id === pet.ownerId)?.firstName}</td>
                                        <td style={{ padding: "15px" }}>
                                        {pet.deletionStatus === "Pending" ? (
                                            <span style={{ color: "orange", fontWeight: "bold" }}>Request Pending</span>
                                        ) : (
                                            <span style={{ color: "#666" }}>Archived</span>
                                        )}
                                        </td>
                                        <td style={{ padding: "15px", fontStyle: "italic", color: "#555" }}>{pet.deletionReason || "N/A"}</td>
                                        <td style={{ padding: "15px" }}>
                                        <div style={{ display: "flex", gap: "8px" }}>
                                            {pet.deletionStatus === "Pending" ? (
                                            <>
                                                <button onClick={() => handleApproveDeletion(pet)} style={{ padding: "6px 12px", background: "#4CAF50", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}>Approve</button>
                                                <button onClick={() => handleRejectDeletion(pet.id)} style={{ padding: "6px 12px", background: "#f44336", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}>Reject</button>
                                            </>
                                            ) : (
                                            <button onClick={() => handleRestorePet(pet.id)} style={{ padding: "6px 12px", background: "#2196F3", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}>Restore</button>
                                            )}
                                        </div>
                                        </td>
                                    </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* --- MODALS --- */}
        {modal.show && (
            <div className="modal-overlay no-print" style={{position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000}}>
                <div style={{ background: "white", padding: "25px", borderRadius: "12px", width: "350px", textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
                    <h3 style={{margin: "0 0 15px 0", color: "#333"}}>{modal.title}</h3>
                    <p style={{marginBottom: "25px", fontSize: "16px", color: "#666"}}>{modal.message}</p>
                    <div style={{display: "flex", justifyContent: "center", gap: "15px"}}>
                        {modal.type === "confirm" ? (
                            <>
                                <button onClick={closeModal} style={{ padding: "10px 20px", background: "#e0e0e0", color: "#333", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>Cancel</button>
                                <button onClick={() => { modal.onConfirm(); }} style={{ padding: "10px 20px", background: "#2196F3", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>Confirm</button>
                            </>
                        ) : (
                            <button onClick={closeModal} style={{ padding: "10px 20px", background: "#2196F3", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>OK</button>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* EDIT USER MODAL */}
        {editingUser && (
            <div className="modal-overlay no-print" style={{position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000}}>
                <div style={{ background: "white", padding: "25px", borderRadius: "12px", width: "400px" }}>
                    <h3 style={{margin: "0 0 20px 0"}}>Edit User</h3>
                    <form onSubmit={handleSaveUser} style={{display: "flex", flexDirection: "column", gap: "15px"}}>
                        <div>
                            <label style={{display: "block", marginBottom: "5px", fontSize: "14px"}}>First Name</label>
                            <input value={editFormData.firstName} onChange={e => setEditFormData({...editFormData, firstName: e.target.value})} style={{width: "100%", padding: "8px", boxSizing: "border-box", borderRadius: "6px", border: "1px solid #ddd"}} required />
                        </div>
                        <div>
                            <label style={{display: "block", marginBottom: "5px", fontSize: "14px"}}>Last Name</label>
                            <input value={editFormData.lastName} onChange={e => setEditFormData({...editFormData, lastName: e.target.value})} style={{width: "100%", padding: "8px", boxSizing: "border-box", borderRadius: "6px", border: "1px solid #ddd"}} required />
                        </div>
                        <div style={{display: "flex", gap: "10px", marginTop: "10px"}}>
                            <button type="button" onClick={() => setEditingUser(null)} style={{flex: 1, padding: "10px", background: "#eee", border: "none", borderRadius: "6px", cursor: "pointer"}}>Cancel</button>
                            <button type="submit" style={{flex: 1, padding: "10px", background: "#2196F3", color: "white", border: "none", borderRadius: "6px", cursor: "pointer"}}>Save Changes</button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {/* PRINT MODAL (HIDDEN IN PRINT) */}
        {showPrintModal && (
            <div className="modal-overlay no-print" style={{position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000}}>
                <div style={{ background: "white", padding: "25px", borderRadius: "12px", width: "500px", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
                    <h3 style={{marginTop: 0}}>Select Pets to Print</h3>
                    <div style={{ marginBottom: "10px" }}>
                        <button onClick={handleSelectAllForPrint} style={{ padding: "5px 10px", fontSize: "12px", cursor: "pointer" }}>
                            {selectedPetsForPrint.length === pets.length ? "Deselect All" : "Select All"}
                        </button>
                    </div>
                    <div style={{ flex: 1, overflowY: "auto", border: "1px solid #eee", padding: "10px", borderRadius: "6px", marginBottom: "15px" }}>
                        {pets.map(pet => (
                            <div key={pet.id} onClick={() => togglePetSelection(pet.id)} style={{ padding: "8px", borderBottom: "1px solid #f9f9f9", display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", background: selectedPetsForPrint.includes(pet.id) ? "#e3f2fd" : "white" }}>
                                <div style={{ width: "16px", height: "16px", borderRadius: "3px", border: "1px solid #ccc", background: selectedPetsForPrint.includes(pet.id) ? "#2196F3" : "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    {selectedPetsForPrint.includes(pet.id) && <span style={{color: "white", fontSize: "12px"}}>✓</span>}
                                </div>
                                <span>{pet.name} <span style={{color: "#888", fontSize: "12px"}}>({users.find(u => u.id === pet.ownerId)?.firstName})</span></span>
                            </div>
                        ))}
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                        <button onClick={() => setShowPrintModal(false)} style={{ padding: "10px 20px", background: "#eee", border: "none", borderRadius: "6px", cursor: "pointer" }}>Cancel</button>
                        <button onClick={executePrint} disabled={selectedPetsForPrint.length === 0} style={{ padding: "10px 20px", background: "#2196F3", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", opacity: selectedPetsForPrint.length === 0 ? 0.5 : 1 }}>Print Selected</button>
                    </div>
                </div>
            </div>
        )}

        {/* --- PRINT ONLY CONTENT --- */}
        <div className="print-only bond-paper">
            <div style={{ textAlign: "center", marginBottom: "20px", borderBottom: "2px solid #333", paddingBottom: "10px" }}>
                <h1 style={{ margin: "0", fontSize: "24px" }}>PawPals Veterinary Clinic</h1>
                <p style={{ margin: "5px 0" }}>123 Pet Street, Animal City • (555) 123-4567</p>
                <h2 style={{ margin: "10px 0 0", fontSize: "18px" }}>
                    {isPrintingAppointments ? "Appointment History Report" : "Registered Pets Report"}
                </h2>
                <p style={{ fontSize: "12px", color: "#666" }}>Generated on: {new Date().toLocaleDateString()}</p>
            </div>

            {isPrintingAppointments ? (
                <table className="print-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Pet Name</th>
                            <th>Owner</th>
                            <th>Service</th>
                            <th>Vet</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredAppointments.map(appt => (
                            <tr key={appt.id}>
                                <td>{appt.date}</td>
                                <td>{pets.find(p => p.id === appt.petId)?.name || "Unknown"}</td>
                                <td>{users.find(u => u.id === appt.userId)?.firstName} {users.find(u => u.id === appt.userId)?.lastName}</td>
                                <td>{appt.reason}</td>
                                <td>{appt.vetName || "-"}</td>
                                <td>{appt.status}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <table className="print-table">
                    <thead>
                        <tr>
                            <th>Pet Name</th>
                            <th>Species/Breed</th>
                            <th>Age/Gender</th>
                            <th>Owner Name</th>
                            <th>Contact</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pets.filter(p => selectedPetsForPrint.includes(p.id)).map(pet => {
                            const owner = users.find(u => u.id === pet.ownerId);
                            return (
                                <tr key={pet.id}>
                                    <td>{pet.name}</td>
                                    <td>{pet.species} / {pet.breed}</td>
                                    <td>{pet.age} / {pet.gender}</td>
                                    <td>{owner?.firstName} {owner?.lastName}</td>
                                    <td>{owner?.email}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}

            <div style={{ marginTop: "50px", textAlign: "right" }}>
                <div style={{ borderTop: "1px solid #333", width: "200px", display: "inline-block", textAlign: "center" }}>
                    <p style={{ margin: "5px 0" }}>Authorized Administrator</p>
                    <p style={{ fontSize: "10px" }}>PawPals Veterinary Clinic Management</p>
                </div>
            </div>
        </div>

      </main>

      {/* --- STYLES --- */}
      <style>{`
          .no-print { display: block; }
          .print-only { display: none; }
          
          @media print {
              .no-print, nav, .main-content > div:first-child, .action-btn, .modal-overlay, button, input, select { display: none !important; }
              body, .dashboard-container, .main-content { background: white !important; overflow: visible !important; height: auto !important; padding: 0 !important; margin: 0 !important; }
              .print-only { display: block !important; padding: 0.75in; font-family: "Times New Roman", serif; color: black; font-size: 14px; }
              .bond-paper { width: 100%; box-sizing: border-box; }
              table { width: 100%; border-collapse: collapse; margin-top: 15px; }
              th, td { border: 1px solid #333; padding: 8px; text-align: left; font-size: 12px; }
              th { background-color: #f0f0f0; font-weight: bold; }
          }

          /* Scrollbar Styling */
          ::-webkit-scrollbar { width: 8px; }
          ::-webkit-scrollbar-track { background: #f1f1f1; }
          ::-webkit-scrollbar-thumb { background: #ccc; borderRadius: 4px; }
          ::-webkit-scrollbar-thumb:hover { background: #bbb; }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
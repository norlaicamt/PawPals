import { useEffect, useState } from "react";
import { auth, db } from "./firebase";
import { signOut } from "firebase/auth";
import { collection, onSnapshot, doc, query, orderBy, updateDoc } from "firebase/firestore"; 
import { useNavigate } from "react-router-dom";
import logoImg from "./assets/logo.png"; 

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
      return () => { unsubUsers(); unsubPets(); unsubAppts(); };
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
            Archive {stats.pendingDeletions > 0 && <span style={{background:"red", color:"white", borderRadius:"50%", padding:"2px 6px", fontSize:"10px", verticalAlign:"middle", marginLeft:"5px"}}>!</span>}
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
                                <span>Pending Archive Requests</span>
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

                          {/* Medical History Section - Centered */}
                          <div style={{ textAlign: "center" }}>
                            <h3 style={{ borderBottom: "1px solid #eee", paddingBottom: "10px", color: "#333" }}>Medical History</h3>
                            {appointments.filter(a => a.petId === viewingRecord.id && a.status === "Done").length > 0 ? (
                                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                                    <thead style={{background: "#f8f9fa"}}>
                                        <tr><th style={{padding:"10px"}}>Date</th><th style={{padding:"10px"}}>Service</th><th style={{padding:"10px"}}>Notes/Remarks</th></tr>
                                    </thead>
                                    <tbody>
                                        {appointments.filter(a => a.petId === viewingRecord.id && a.status === "Done").map(a => (
                                            <tr key={a.id} style={{borderBottom: "1px solid #eee"}}>
                                                <td style={{padding:"10px"}}>{new Date(a.date).toLocaleDateString()}</td>
                                                <td style={{padding:"10px"}}>{a.reason}</td>
                                                <td style={{padding:"10px", fontStyle: "italic", color: "#555" }}>{a.notes || "No remarks"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <p style={{ padding: "40px", color: "#999" }}>No medical records found for this pet.</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#999" }}>
                          <span style={{ fontSize: "50px" }}>🐾</span>
                          <p>Select a pet from the list to view their full medical history</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: "flex", gap: "15px", marginBottom: "20px" }}>
                      <select value={recordStatus} onChange={(e) => setRecordStatus(e.target.value)} style={{ padding: "10px", borderRadius: "8px", border: "1px solid #ccc" }}>
                        <option value="All">All Status</option>
                        <option value="Pending">Pending</option>
                        <option value="Confirmed">Confirmed</option>
                        <option value="Done">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                      <select value={recordServiceFilter} onChange={(e) => setRecordServiceFilter(e.target.value)} style={{ padding: "10px", borderRadius: "8px", border: "1px solid #ccc" }}>
                        <option value="All">All Services</option>
                        {uniqueServices.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead style={{ position: "sticky", top: 0, background: "white", boxShadow: "0 2px 5px rgba(0,0,0,0.05)" }}>
                        <tr style={{ textAlign: "left", color: "#666" }}>
                            <th style={{ padding: "15px" }}>Date</th>
                            <th style={{ padding: "15px" }}>Pet</th>
                            <th style={{ padding: "15px" }}>Owner</th>
                            <th style={{ padding: "15px" }}>Service</th>
                            <th style={{ padding: "15px" }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAppointments.map(a => (
                          <tr key={a.id} style={{ borderBottom: "1px solid #f1f1f1" }}>
                            <td style={{ padding: "15px" }}>{new Date(a.date).toLocaleDateString()}</td>
                            <td style={{ padding: "15px", fontWeight: "bold" }}>{[...pets, ...archivedPets].find(p => p.id === a.petId)?.name || "N/A"}</td>
                            <td style={{ padding: "15px" }}>{users.find(u => u.id === a.ownerId)?.firstName || "N/A"}</td>
                            <td style={{ padding: "15px" }}>{a.reason}</td>
                            <td style={{ padding: "15px" }}>
                              <span style={{ padding: "4px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "bold", background: a.status === "Done" ? "#e8f5e9" : a.status === "Cancelled" ? "#ffebee" : "#fff3e0", color: a.status === "Done" ? "#2e7d32" : a.status === "Cancelled" ? "#d32f2f" : "#ef6c00" }}>{a.status}</span>
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

          {/* --- ARCHIVE VIEW --- */}
          {activeView === "archive" && (
            <div className="card no-print" style={{ background: "white", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", height: "100%", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "20px", borderBottom: "1px solid #eee" }}>
                <h3 style={{ margin: 0 }}>Pet Archive & Deletion Requests</h3>
              </div>
              <div style={{ flex: 1, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead style={{ position: "sticky", top: 0, background: "white", boxShadow: "0 2px 5px rgba(0,0,0,0.05)" }}>
                    <tr style={{ textAlign: "left", color: "#666" }}>
                        <th style={{ padding: "15px" }}>Pet Name</th>
                        <th style={{ padding: "15px" }}>Owner</th>
                        <th style={{ padding: "15px" }}>Status</th>
                        <th style={{ padding: "15px" }}>Reason (if deletion)</th>
                        <th style={{ padding: "15px" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {archivedPets.map(pet => (
                      <tr key={pet.id} style={{ borderBottom: "1px solid #f1f1f1" }}>
                        <td style={{ padding: "15px", fontWeight: "bold" }}>{pet.name}</td>
                        <td style={{ padding: "15px" }}>{users.find(u => u.id === pet.ownerId)?.firstName || "Unknown"}</td>
                        <td style={{ padding: "15px" }}>
                          <span style={{ padding: "4px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "bold", background: pet.deletionStatus === "Pending" ? "#fff3e0" : "#f5f5f5", color: pet.deletionStatus === "Pending" ? "#ef6c00" : "#666" }}>
                            {pet.deletionStatus === "Pending" ? "Deletion Requested" : "Archived"}
                          </span>
                        </td>
                        <td style={{ padding: "15px", fontSize: "12px", maxWidth: "200px" }}>{pet.deletionReason || "N/A"}</td>
                        <td style={{ padding: "15px" }}>
                          <div style={{ display: "flex", gap: "5px" }}>
                            {pet.deletionStatus === "Pending" ? (
                              <>
                                <button onClick={() => handleApproveDeletion(pet)} style={{ padding: "6px 12px", fontSize: "11px", background: "#d32f2f", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}>Approve</button>
                                <button onClick={() => handleRejectDeletion(pet.id)} style={{ padding: "6px 12px", fontSize: "11px", background: "#eee", color: "#333", border: "none", borderRadius: "6px", cursor: "pointer" }}>Reject</button>
                              </>
                            ) : (
                              <button onClick={() => handleRestorePet(pet.id)} style={{ padding: "6px 12px", fontSize: "11px", background: "#4CAF50", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}>Restore</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* --- MODALS --- */}
        
        {/* Edit User Modal */}
        {editingUser && (
          <div className="modal-overlay no-print" style={{position:"fixed", top:0, left:0, width:"100%", height:"100%", background:"rgba(0,0,0,0.5)", display:"flex", justifyContent:"center", alignItems:"center", zIndex:2000}}>
            <div className="modal-content" style={{background:"white", padding:"25px", borderRadius:"12px", width:"400px", boxShadow: "0 10px 30px rgba(0,0,0,0.3)"}}>
              <h3 style={{marginTop: 0, color: "#333"}}>Edit User Details</h3>
              <form onSubmit={handleSaveUser}>
                <input type="text" placeholder="First Name" value={editFormData.firstName} onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })} required style={{width:"100%", padding:"10px", borderRadius:"6px", border:"1px solid #ddd", boxSizing: "border-box"}} />
                <input type="text" placeholder="Last Name" value={editFormData.lastName} onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })} required style={{ marginTop: "10px", width:"100%", padding:"10px", borderRadius:"6px", border:"1px solid #ddd", boxSizing: "border-box" }} />
                <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                  <button type="submit" style={{ padding: "10px 20px", background: "#2196F3", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", flex: 1 }}>Save Changes</button>
                  <button type="button" onClick={() => setEditingUser(null)} style={{ padding: "10px 20px", background: "#eee", color: "#333", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", flex: 1 }}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Print Selection Modal - Scrollable List */}
        {showPrintModal && (
          <div className="modal-overlay no-print" style={{position:"fixed", top:0, left:0, width:"100%", height:"100%", background:"rgba(0,0,0,0.5)", display:"flex", justifyContent:"center", alignItems:"center", zIndex:2000}}>
            <div className="modal-content" style={{background:"white", padding:"25px", borderRadius:"12px", width:"500px", maxHeight:"80vh", display: "flex", flexDirection: "column", boxShadow: "0 10px 30px rgba(0,0,0,0.3)"}}>
                <h3 style={{ textAlign: "center", borderBottom: "1px solid #eee", paddingBottom: "15px", marginTop: 0 }}>Print Pet Records Selection</h3>
                <p style={{ fontSize: "14px", color: "#666", marginBottom: "15px" }}>Select the pets you want to include in the printed report:</p>
                
                <div style={{ flex: 1, overflowY: "auto", border: "1px solid #eee", borderRadius: "8px", padding: "10px", marginBottom: "20px", background: "#f9f9f9" }}>
                    <div style={{ display: "flex", alignItems: "center", padding: "10px", borderBottom: "2px solid #ddd", marginBottom: "10px", background: "white" }}>
                        <input type="checkbox" checked={selectedPetsForPrint.length === pets.length && pets.length > 0} onChange={handleSelectAllForPrint} style={{ width: "18px", height: "18px", cursor: "pointer" }} />
                        <label style={{ marginLeft: "10px", fontWeight: "bold", cursor: "pointer" }}>Select All Pets</label>
                    </div>
                    {pets.sort((a,b) => a.name.localeCompare(b.name)).map(pet => (
                        <div key={pet.id} style={{ display: "flex", alignItems: "center", padding: "8px 10px", borderBottom: "1px solid #eee" }}>
                            <input type="checkbox" checked={selectedPetsForPrint.includes(pet.id)} onChange={() => togglePetSelection(pet.id)} style={{ width: "16px", height: "16px", cursor: "pointer" }} />
                            <label style={{ marginLeft: "10px", cursor: "pointer" }}>{pet.name} <span style={{color: "#888", fontSize: "12px"}}>({pet.species})</span></label>
                        </div>
                    ))}
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                    <button onClick={executePrint} disabled={selectedPetsForPrint.length === 0} style={{ padding: "10px 20px", background: selectedPetsForPrint.length > 0 ? "#4CAF50" : "#ccc", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", flex: 1 }}>Generate Print View ({selectedPetsForPrint.length})</button>
                    <button onClick={() => setShowPrintModal(false)} style={{ padding: "10px 20px", background: "#eee", color: "#333", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", flex: 1 }}>Cancel</button>
                </div>
            </div>
          </div>
        )}

        {/* Global Custom Alert/Confirm Modal */}
        {modal.show && (
            <div className="modal-overlay no-print" style={{position:"fixed", top:0, left:0, width:"100%", height:"100%", background:"rgba(0,0,0,0.5)", display:"flex", justifyContent:"center", alignItems:"center", zIndex: 3000}}>
                <div style={{ background: "white", padding: "25px", borderRadius: "12px", width: "350px", boxShadow: "0 10px 25px rgba(0,0,0,0.2)", textAlign: "center" }}>
                    <h3 style={{ marginTop: 0, color: modal.type === "alert" ? "#2196F3" : "#333" }}>{modal.title}</h3>
                    <p style={{ color: "#666", marginBottom: "25px", lineHeight: "1.5" }}>{modal.message}</p>
                    <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                        {modal.type === "confirm" ? (
                            <>
                                <button onClick={modal.onConfirm} style={{ background: "#d32f2f", color: "white", border: "none", padding: "10px 20px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", flex: 1 }}>Yes, Proceed</button>
                                <button onClick={closeModal} style={{ background: "#eee", color: "#333", border: "none", padding: "10px 20px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", flex: 1 }}>Cancel</button>
                            </>
                        ) : (
                            <button onClick={closeModal} style={{ background: "#2196F3", color: "white", border: "none", padding: "10px 20px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", width: "100%" }}>OK</button>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* --- PRINT CONTENT --- */}
        <div className="print-only bond-paper">
            <div style={{ textAlign: "center", borderBottom: "2px solid #333", paddingBottom: "20px", marginBottom: "30px" }}>
                <h1 style={{ margin: 0 }}>PAWPALS VETERINARY CLINIC</h1>
                <p style={{ margin: "5px 0" }}>Comprehensive System Data Report</p>
                <p style={{ fontSize: "12px" }}>Generated on: {new Date().toLocaleString()}</p>
            </div>

            {isPrintingAppointments ? (
                // Print Layout for Appointments List
                <div>
                    <h2 style={{ textDecoration: "underline", marginBottom: "15px" }}>Appointment Database Records</h2>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                            <tr style={{ background: "#f0f0f0" }}>
                                <th style={{ border: "1px solid #333", padding: "8px" }}>Date</th>
                                <th style={{ border: "1px solid #333", padding: "8px" }}>Pet Name</th>
                                <th style={{ border: "1px solid #333", padding: "8px" }}>Owner</th>
                                <th style={{ border: "1px solid #333", padding: "8px" }}>Service/Reason</th>
                                <th style={{ border: "1px solid #333", padding: "8px" }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAppointments.map(a => (
                                <tr key={a.id}>
                                    <td style={{ border: "1px solid #333", padding: "8px" }}>{new Date(a.date).toLocaleDateString()}</td>
                                    {/* FIXED: Check both active and archived pets to prevent N/A names in print report */}
                                    <td style={{ border: "1px solid #333", padding: "8px" }}>{[...pets, ...archivedPets].find(p => p.id === a.petId)?.name || "N/A"}</td>
                                    <td style={{ border: "1px solid #333", padding: "8px" }}>{users.find(u => u.id === a.ownerId)?.firstName || "N/A"}</td>
                                    <td style={{ border: "1px solid #333", padding: "8px" }}>{a.reason}</td>
                                    <td style={{ border: "1px solid #333", padding: "8px" }}>{a.status}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                // Print Layout for Selected Pet Records
                <div>
                    {pets.filter(p => selectedPetsForPrint.includes(p.id)).map((pet, idx) => (
                        <div key={pet.id} style={{ marginBottom: "50px", pageBreakAfter: idx === selectedPetsForPrint.length - 1 ? "auto" : "always" }}>
                            <div style={{ border: "1px solid #ccc", padding: "20px" }}>
                                <h2 style={{ color: "#1565C0", margin: "0 0 10px 0" }}>PET MEDICAL RECORD: {pet.name.toUpperCase()}</h2>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "20px", fontSize: "14px" }}>
                                    <div><b>Species:</b> {pet.species}</div>
                                    <div><b>Breed:</b> {pet.breed}</div>
                                    <div><b>Gender:</b> {pet.gender}</div>
                                    <div><b>Owner:</b> {users.find(u => u.id === pet.ownerId)?.firstName} {users.find(u => u.id === pet.ownerId)?.lastName}</div>
                                </div>
                                <h3 style={{ borderBottom: "1px solid #333", paddingBottom: "5px" }}>Clinical Visit History</h3>
                                <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "10px" }}>
                                    <thead>
                                        <tr>
                                            <th style={{ border: "1px solid #333", padding: "8px", textAlign: "left" }}>Date</th>
                                            <th style={{ border: "1px solid #333", padding: "8px", textAlign: "left" }}>Service Rendered</th>
                                            <th style={{ border: "1px solid #333", padding: "8px", textAlign: "left" }}>Notes / Findings</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {appointments.filter(a => a.petId === pet.id && a.status === "Done").length > 0 ? (
                                            appointments.filter(a => a.petId === pet.id && a.status === "Done").map(a => (
                                                <tr key={a.id}>
                                                    <td style={{ border: "1px solid #333", padding: "8px" }}>{new Date(a.date).toLocaleDateString()}</td>
                                                    <td style={{ border: "1px solid #333", padding: "8px" }}>{a.reason}</td>
                                                    <td style={{ border: "1px solid #333", padding: "8px" }}>{a.notes || "---"}</td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr><td colSpan="3" style={{ border: "1px solid #333", padding: "20px", textAlign: "center" }}>No historical medical data found for this pet.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
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
              th, td { border: 1px solid #333; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2 !important; -webkit-print-color-adjust: exact; }
          }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
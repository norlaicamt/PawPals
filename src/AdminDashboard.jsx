import { useEffect, useState } from "react";
import { auth, db } from "./firebase";
import { signOut, sendPasswordResetEmail } from "firebase/auth";
import { collection, onSnapshot, doc, query, orderBy, updateDoc } from "firebase/firestore"; 
import { useNavigate } from "react-router-dom";
import logoImg from './logo.png'; 

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
        <div style={{ background: "white", padding: "15px", borderRadius: "12px", boxShadow: "0 2px 5px rgba(0,0,0,0.05)", height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", border: "1px solid #eee" }}>
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
  const [activeView, setActiveView] = useState("accounts");
  const [userTab, setUserTab] = useState("owner");
  const [userSearch, setUserSearch] = useState("");
  const [petSearch, setPetSearch] = useState("");
  const [speciesFilter, setSpeciesFilter] = useState("All");
  
  // Records Tab
  const [recordTab, setRecordTab] = useState("pets");
  const [recordPetSearch, setRecordPetSearch] = useState(""); 
  const [recordStatus, setRecordStatus] = useState("All");
  const [recordServiceFilter, setRecordServiceFilter] = useState("All");

  // Edit User
  const [editingUser, setEditingUser] = useState(null);
  const [editFormData, setEditFormData] = useState({ firstName: "", lastName: "" });

  // View Record (For the View Box)
  const [viewingRecord, setViewingRecord] = useState(null);

  // --- NEW: PRINT STATES ---
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedPetsForPrint, setSelectedPetsForPrint] = useState([]);

  // --- CUSTOM MODAL STATE ---
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

  const handleSendResetEmail = async () => {
      if(editingUser && editingUser.email) {
          try { 
              await sendPasswordResetEmail(auth, editingUser.email); 
              showAlert("Email Sent", `Password reset email sent to ${editingUser.email}`);
          } catch (error) { showAlert("Error", "Error sending email: " + error.message); }
      }
  };

  // --- PRINT LOGIC ---
  const togglePetSelection = (petId) => {
      setSelectedPetsForPrint(prev => 
          prev.includes(petId) ? prev.filter(id => id !== petId) : [...prev, petId]
      );
  };

  const handleSelectAllForPrint = () => {
      if (selectedPetsForPrint.length === filteredRecordData.length) {
          setSelectedPetsForPrint([]); // Deselect all
      } else {
          setSelectedPetsForPrint(filteredRecordData.map(p => p.id)); // Select all
      }
  };

  const handlePrintButtonClick = () => {
      if (recordTab === "pets") {
          // If in Pets tab, open the selection modal
          setSelectedPetsForPrint([]); 
          setShowPrintModal(true);
      } else {
          // If in Appointments tab, just print everything currently filtered
          window.print();
      }
  };

  const executePrint = () => {
      setShowPrintModal(false);
      // Wait a moment for modal to close, then trigger browser print
      setTimeout(() => {
          window.print();
      }, 500);
  };

  // --- FILTERS & CALCULATIONS ---
  
  const uniqueServices = [...new Set(appointments.map(a => a.reason).filter(Boolean))].sort();

  const getFilteredUsers = () => {
      let filtered = users.filter(u => 
        (u.firstName?.toLowerCase().includes(userSearch.toLowerCase()) || 
         u.lastName?.toLowerCase().includes(userSearch.toLowerCase()) || 
         u.email?.toLowerCase().includes(userSearch.toLowerCase()))
      );
      return userTab === "disabled" ? filtered.filter(u => u.isDisabled === true) : filtered.filter(u => u.role === userTab && !u.isDisabled);
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

  const getFilteredRecords = () => {
      if (recordTab === "pets") {
          const search = recordPetSearch.toLowerCase();
          return pets.filter(p => p.name.toLowerCase().includes(search));
      } else {
          let data = appointments;
          if (recordStatus !== "All") {
              data = data.filter(a => a.status === recordStatus);
          }
          if (recordServiceFilter !== "All") {
              data = data.filter(a => a.reason === recordServiceFilter);
          }
          return data;
      }
  };
  const filteredRecordData = getFilteredRecords();

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
      <nav className="navbar" style={{ flexShrink: 0 }}>
        <div className="logo"><img src={logoImg} alt="PawPals" className="logo-img" /> PawPals Admin</div>
        <button onClick={handleLogout} className="action-btn" style={{background: "#ffebee", color: "#d32f2f"}}>Logout</button>
      </nav>

      <main className="main-content" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "20px", maxWidth: "1200px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "15px", marginBottom: "20px", flexShrink: 0 }}>
          <button style={getTabStyle("accounts")} onClick={() => setActiveView("accounts")}>👥 Accounts</button>
          <button style={getTabStyle("pets")} onClick={() => setActiveView("pets")}>🐾 Pets List</button>
          <button style={getTabStyle("records")} onClick={() => setActiveView("records")}>📊 Records</button> 
          <button style={getTabStyle("archive")} onClick={() => setActiveView("archive")}>📦 Archive {archivedPets.some(p => p.deletionStatus === 'Pending') && <span style={{background:"red", color:"white", borderRadius:"50%", padding:"2px 6px", fontSize:"10px", verticalAlign:"middle"}}>!</span>}</button>
        </div>

        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

            {activeView === "accounts" && (
                <div className="card" style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: "20px", boxSizing: "border-box" }}>
                    <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"15px", flexShrink: 0}}>
                        <h3>User Accounts</h3>
                        <div style={{display:"flex", gap:"10px"}}>
                            {["owner", "staff"].map(role => (
                                <button key={role} onClick={() => setUserTab(role)} style={{textTransform:"capitalize", background: userTab === role ? "#2196F3" : "#eee", color: userTab === role ? "white" : "#555", border:"none", padding:"8px 15px", borderRadius:"20px", cursor:"pointer", fontWeight:"bold"}}>{role}s</button>
                            ))}
                            <button onClick={() => setUserTab("disabled")} style={{background: userTab === "disabled" ? "#607D8B" : "#eee", color: userTab === "disabled" ? "white" : "#555", border:"none", padding:"8px 15px", borderRadius:"20px", cursor:"pointer", fontWeight:"bold"}}>🚫 Disabled</button>
                        </div>
                    </div>
                    <input type="text" placeholder="🔍 Search by name or email..." value={userSearch} onChange={e => setUserSearch(e.target.value)} style={{marginBottom:"15px", padding:"10px", borderRadius:"20px", border:"1px solid #ddd", width:"300px", flexShrink: 0}} />
                    <div style={{flex: 1, overflowY: "auto"}}>
                        <table style={{width: "100%", borderCollapse: "collapse"}}>
                            <thead><tr style={{background:"#f9f9f9", textAlign:"left"}}><th style={{padding:"10px"}}>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
                            <tbody>
                                {getFilteredUsers().length === 0 ? <tr><td colSpan="5" style={{textAlign:"center", padding:"20px", color:"#888"}}>No {userTab} accounts found.</td></tr> : getFilteredUsers().map(u => (
                                    <tr key={u.id} style={{borderBottom:"1px solid #eee"}}>
                                        <td style={{padding:"10px"}}><strong>{u.firstName} {u.lastName}</strong></td>
                                        <td>{u.email}</td>
                                        <td style={{textTransform:"capitalize"}}>{u.role}</td>
                                        <td>{u.isDisabled ? <span style={{color:"red", fontWeight:"bold"}}>Disabled</span> : <span style={{color:"green"}}>Active</span>}</td>
                                        <td>
                                            <button onClick={() => handleEditUser(u)} style={{marginRight:"10px", background:"#e3f2fd", color:"#2196F3", border:"none", padding:"5px 10px", borderRadius:"5px", cursor:"pointer"}}>Edit</button>
                                            {u.isDisabled ? <button onClick={() => handleToggleUserStatus(u.id, u.isDisabled)} style={{background:"#E8F5E9", color:"#2E7D32", border:"1px solid #2E7D32", padding:"5px 10px", borderRadius:"5px", cursor:"pointer"}}>✅ Enable</button> : <button onClick={() => handleToggleUserStatus(u.id, u.isDisabled)} style={{background:"#ffebee", color:"#d32f2f", border:"1px solid #d32f2f", padding:"5px 10px", borderRadius:"5px", cursor:"pointer"}}>🚫 Disable</button>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeView === "pets" && (
                <div className="card" style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: "20px", boxSizing: "border-box" }}>
                    <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"15px", flexShrink: 0}}>
                        <h3>All Registered Pets</h3>
                        <select value={speciesFilter} onChange={e => setSpeciesFilter(e.target.value)} style={{padding:"8px", borderRadius:"5px", border:"1px solid #ddd"}}>
                            <option value="All">All Species</option>
                            <option value="Dog">Dogs</option>
                            <option value="Cat">Cats</option>
                            <option value="Other">Others</option>
                        </select>
                    </div>
                    <input type="text" placeholder="🔍 Search Pet or Owner..." value={petSearch} onChange={e => setPetSearch(e.target.value)} style={{marginBottom:"15px", padding:"10px", borderRadius:"20px", border:"1px solid #ddd", width:"300px", flexShrink: 0}} />
                    <div style={{flex: 1, overflowY: "auto"}}>
                        <table style={{width: "100%", borderCollapse: "collapse"}}>
                            <thead><tr style={{background:"#f9f9f9", textAlign:"left"}}><th style={{padding:"10px"}}>Pet Name</th><th>Species</th><th>Breed</th><th>Owner</th><th>Actions</th></tr></thead>
                            <tbody>
                                {filteredPets.length === 0 ? <tr><td colSpan="5" style={{textAlign:"center", padding:"20px", color:"#888"}}>No pets found matching filters.</td></tr> : filteredPets.map(p => {
                                    const owner = users.find(u => u.id === p.ownerId);
                                    return (
                                        <tr key={p.id} style={{borderBottom:"1px solid #eee"}}>
                                            <td style={{padding:"10px"}}><strong>{p.name}</strong></td>
                                            <td>{p.species}</td>
                                            <td>{p.breed}</td>
                                            <td>{owner ? `${owner.firstName} ${owner.lastName}` : "Unknown"}</td>
                                            <td><button onClick={() => handleManualArchive(p.id)} style={{background:"#fff3e0", color:"#ef6c00", border:"none", padding:"5px 10px", borderRadius:"5px", cursor:"pointer"}}>📦 Archive</button></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeView === "records" && (
                <div style={{ display: "flex", gap: "20px", height: "100%", overflow: "hidden" }}>
                    {recordTab === "pets" && (
                        <div style={{ flex: "0 0 35%", minWidth: "300px", height: "100%" }}>
                             {breedChartData.length > 0 ? (
                                <SimpleBarChart data={breedChartData} title="Breed Distribution" />
                             ) : (
                                <div className="card" style={{height:"100%", display:"flex", alignItems:"center", justifyContent:"center", color:"#888"}}>No Data Available</div>
                             )}
                        </div>
                    )}
                    <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", padding: "20px", boxSizing: "border-box", overflow: "hidden" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px", flexShrink: 0 }}>
                            <h3>System Records</h3>
                            <div style={{ display: "flex", background: "#f1f1f1", borderRadius: "20px", padding: "2px" }}>
                                <button onClick={() => setRecordTab("pets")} style={{ background: recordTab === "pets" ? "white" : "transparent", border: "none", borderRadius: "18px", padding: "6px 20px", cursor: "pointer", fontWeight: "bold", boxShadow: recordTab === "pets" ? "0 2px 4px rgba(0,0,0,0.1)" : "none" }}>Pets</button>
                                <button onClick={() => setRecordTab("appointments")} style={{ background: recordTab === "appointments" ? "white" : "transparent", border: "none", borderRadius: "18px", padding: "6px 20px", cursor: "pointer", fontWeight: "bold", boxShadow: recordTab === "appointments" ? "0 2px 4px rgba(0,0,0,0.1)" : "none" }}>Appointments</button>
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: "10px", marginBottom: "15px", flexWrap: "wrap", padding: "10px", background: "#f9f9f9", borderRadius: "8px", flexShrink: 0 }}>
                            
                            {/* --- CONDITIONAL FILTERS --- */}
                            
                            {recordTab === "pets" ? (
                                <input type="text" placeholder="Search Pet..." value={recordPetSearch} onChange={e => setRecordPetSearch(e.target.value)} style={{ padding: "8px", borderRadius: "5px", border: "1px solid #ccc", flex: 1 }} />
                            ) : (
                                // --- APPOINTMENTS FILTERS ---
                                <>
                                    <div style={{display:"flex", alignItems:"center", gap:"5px", flex: 1}}>
                                        <span style={{fontSize:"13px", fontWeight:"bold", color:"#555"}}>Service:</span>
                                        <select 
                                            value={recordServiceFilter} 
                                            onChange={e => setRecordServiceFilter(e.target.value)} 
                                            style={{ padding: "8px", borderRadius: "5px", border: "1px solid #ccc", flex: 1, minWidth: "150px" }}
                                        >
                                            <option value="All">All Services</option>
                                            {uniqueServices.map((service, i) => (
                                                <option key={i} value={service}>{service}</option>
                                            ))}
                                        </select>
                                    </div>
                                    
                                    <div style={{display:"flex", alignItems:"center", gap:"5px"}}>
                                        <span style={{fontSize:"13px", fontWeight:"bold", color:"#555"}}>Status:</span>
                                        <select value={recordStatus} onChange={e => setRecordStatus(e.target.value)} style={{ padding: "8px", borderRadius: "5px", border: "1px solid #ccc" }}>
                                            <option value="All">All</option>
                                            <option value="Done">Completed</option>
                                            <option value="Approved">Approved</option>
                                            <option value="Cancelled">Cancelled</option>
                                        </select>
                                    </div>
                                </>
                            )}
                            
                            {/* --- PRINT BUTTON --- */}
                            <button 
                                onClick={handlePrintButtonClick} 
                                style={{ background: "#607D8B", color: "white", border: "none", padding: "8px 15px", borderRadius: "5px", cursor: "pointer" }}
                            >
                                🖨️ Print {recordTab === "pets" ? "Selection" : "Report"}
                            </button>

                        </div>
                        <div style={{ flex: 1, overflowY: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                                <thead>
                                    <tr style={{ background: "#eee", textAlign: "left" }}>
                                        {recordTab === "pets" ? (
                                            <>
                                                <th style={{padding:"10px"}}>Pet Name</th>
                                                <th>Species</th>
                                                <th style={{textAlign:"center"}}>Actions</th>
                                            </>
                                        ) : (
                                            <><th>Date</th><th>Pet</th><th>Service</th><th>Status</th><th>Notes</th></>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRecordData.length === 0 ? <tr><td colSpan="5" style={{ textAlign: "center", padding: "20px" }}>No records found.</td></tr> : filteredRecordData.map(item => {
                                        if (recordTab === "pets") {
                                            return (
                                                <tr key={item.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                                                    <td style={{ padding: "8px" }}>{item.name}</td>
                                                    <td>{item.species}</td>
                                                    <td style={{textAlign:"center"}}>
                                                        <button 
                                                            onClick={() => setViewingRecord(item)}
                                                            style={{
                                                                background: "#1976D2", color: "white", border: "none", 
                                                                padding: "5px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "11px"
                                                            }}
                                                        >
                                                            👁️ View
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        } else {
                                            return (
                                                <tr key={item.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                                                    <td style={{ padding: "8px" }}>{item.date}</td><td>{item.petName}</td>
                                                    <td>{item.reason}</td>
                                                    <td><span style={{ padding: "2px 6px", borderRadius: "4px", color: "white", fontSize: "11px", background: item.status === "Done" ? "#2196F3" : (item.status === "Cancelled" ? "red" : "green") }}>{item.status}</span></td>
                                                    <td>{item.diagnosis || item.cancellationReason || "-"}</td>
                                                </tr>
                                            );
                                        }
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* --- ARCHIVE VIEW --- */}
            {activeView === "archive" && (
                <div className="card" style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: "20px", boxSizing: "border-box" }}>
                    <h3>📦 Archived Pets & Deletion Requests</h3>
                    <div style={{flex: 1, overflowY: "auto"}}>
                        {archivedPets.length === 0 ? <p style={{color:"#888"}}>No archived pets.</p> : (
                            <table style={{width: "100%", borderCollapse: "collapse"}}>
                                <thead><tr style={{background:"#f9f9f9", textAlign:"left"}}><th style={{padding:"10px"}}>Pet Name</th><th>Owner</th><th>Reason</th><th>Status</th><th>Actions</th></tr></thead>
                                <tbody>
                                    {archivedPets.map(p => {
                                        const owner = users.find(u => u.id === p.ownerId);
                                        const isPending = p.deletionStatus === "Pending";
                                        return (
                                            <tr key={p.id} style={{borderBottom:"1px solid #eee", background: isPending ? "#fff8e1" : "transparent"}}>
                                                <td style={{padding:"10px"}}><strong>{p.name}</strong></td>
                                                <td>{owner ? `${owner.firstName} ${owner.lastName}` : "Unknown"}</td>
                                                <td>{p.deletionReason || "Manual Archive"}</td>
                                                <td>{isPending ? <span style={{color:"orange", fontWeight:"bold", fontSize:"12px"}}>⚠️ Request Pending</span> : <span style={{color:"gray", fontSize:"12px"}}>Archived</span>}</td>
                                                <td style={{display: "flex", gap: "5px", alignItems: "center", padding: "8px 0"}}>
                                                    {isPending ? (
                                                        <>
                                                            <button onClick={() => handleApproveDeletion(p)} style={{background:"red", color:"white", border:"none", padding:"5px 10px", borderRadius:"5px", cursor:"pointer", fontSize:"12px"}}>Approve Delete</button>
                                                            <button onClick={() => handleRejectDeletion(p.id)} style={{background:"#eee", color:"black", border:"1px solid #ccc", padding:"5px 10px", borderRadius:"5px", cursor:"pointer", fontSize:"12px"}}>Reject</button>
                                                        </>
                                                    ) : (
                                                        <button onClick={() => handleRestorePet(p.id)} style={{background:"#E8F5E9", color:"green", border:"1px solid green", padding:"5px 10px", borderRadius:"5px", cursor:"pointer", fontSize:"12px"}}>Restore</button>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}
        </div>

        {/* --- 1. PRINT SELECTION MODAL (PETS) --- */}
        {showPrintModal && (
            <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 3000 }}>
                <div style={{ background: "white", padding: "20px", borderRadius: "12px", width: "400px", maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 10px 25px rgba(0,0,0,0.3)" }}>
                    <h3 style={{ marginTop: 0, borderBottom: "1px solid #eee", paddingBottom: "10px", color: "#333" }}>🖨️ Select Pets to Print</h3>
                    
                    <div style={{ padding: "10px 0", borderBottom: "1px solid #eee", marginBottom: "10px" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: "10px", fontWeight: "bold", cursor: "pointer" }}>
                            <input 
                                type="checkbox" 
                                checked={selectedPetsForPrint.length === filteredRecordData.length && filteredRecordData.length > 0}
                                onChange={handleSelectAllForPrint}
                            />
                            Select All ({filteredRecordData.length})
                        </label>
                    </div>

                    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
                        {filteredRecordData.map(pet => (
                            <label key={pet.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px", background: selectedPetsForPrint.includes(pet.id) ? "#e3f2fd" : "#f9f9f9", borderRadius: "6px", cursor: "pointer" }}>
                                <input 
                                    type="checkbox" 
                                    checked={selectedPetsForPrint.includes(pet.id)}
                                    onChange={() => togglePetSelection(pet.id)}
                                />
                                <span>
                                    <strong>{pet.name}</strong> <span style={{fontSize:"12px", color:"#666"}}>({pet.species})</span>
                                </span>
                            </label>
                        ))}
                    </div>

                    <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                        <button onClick={executePrint} disabled={selectedPetsForPrint.length === 0} style={{ flex: 1, background: selectedPetsForPrint.length === 0 ? "#ccc" : "#2196F3", color: "white", border: "none", padding: "10px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>
                            Print Selected ({selectedPetsForPrint.length})
                        </button>
                        <button onClick={() => setShowPrintModal(false)} style={{ flex: 1, background: "#eee", color: "#333", border: "none", padding: "10px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* --- 2. HIDDEN PRINTABLE LAYOUT (Only visible on paper) --- */}
        <div id="print-area">
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    #print-area, #print-area * { visibility: visible; }
                    #print-area { position: absolute; left: 0; top: 0; width: 100%; }
                    @page { margin: 20px; size: auto; }
                    /* Styling for Pet Cards */
                    .pet-record-page { page-break-inside: avoid; margin-bottom: 30px; border-bottom: 2px dashed #ccc; padding-bottom: 20px; }
                    /* Styling for Appointment Table */
                    .appointment-table-view table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
                    .appointment-table-view th, .appointment-table-view td { border: 1px solid #999; padding: 6px; text-align: left; vertical-align: top; }
                    .appointment-table-view th { background: #eee; }
                }
                @media screen {
                    #print-area { display: none; }
                }
            `}</style>

            <div style={{ fontFamily: "Arial, sans-serif", color: "#333", maxWidth: "800px", margin: "0 auto" }}>
                <h2 style={{textAlign: "center", borderBottom: "2px solid #333", paddingBottom: "10px", marginBottom: "20px" }}>
                    PawPals Veterinary Records {recordTab === "appointments" && "- Appointment Log"}
                </h2>
                
                {/* === A. PET PRINT VIEW === */}
                {recordTab === "pets" && pets.filter(p => selectedPetsForPrint.includes(p.id)).map(pet => {
                    const owner = users.find(u => u.id === pet.ownerId);
                    const petHistory = appointments.filter(a => a.petName === pet.name && a.ownerId === pet.ownerId);

                    return (
                        <div key={pet.id} className="pet-record-page">
                            {/* Header: Basic Info */}
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px", background: "#f5f5f5", padding: "15px", borderRadius: "8px", border: "1px solid #ddd" }}>
                                <div style={{ width: "48%" }}>
                                    <h3 style={{ marginTop: 0, color: "#1976D2", fontSize: "16px" }}>🐾 Pet Details</h3>
                                    <p style={{margin: "5px 0"}}><strong>Name:</strong> {pet.name}</p>
                                    <p style={{margin: "5px 0"}}><strong>Species:</strong> {pet.species} | <strong>Breed:</strong> {pet.breed || "N/A"}</p>
                                </div>
                                <div style={{ width: "48%" }}>
                                    <h3 style={{ marginTop: 0, color: "#388E3C", fontSize: "16px" }}>👤 Owner Details</h3>
                                    <p style={{margin: "5px 0"}}><strong>Name:</strong> {owner ? `${owner.firstName} ${owner.lastName}` : "Unknown"}</p>
                                    <p style={{margin: "5px 0"}}><strong>Contact:</strong> {owner?.phone || owner?.email || "N/A"}</p>
                                </div>
                            </div>

                            {/* Table: Medical History */}
                            <h4 style={{ borderBottom: "1px solid #000", paddingBottom: "5px", marginBottom: "10px" }}>📋 Medical History</h4>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", border: "1px solid #ddd" }}>
                                <thead>
                                    <tr style={{ background: "#eee", textAlign: "left" }}>
                                        <th style={{ border: "1px solid #999", padding: "8px" }}>Date</th>
                                        <th style={{ border: "1px solid #999", padding: "8px" }}>Service</th>
                                        <th style={{ border: "1px solid #999", padding: "8px" }}>Status</th>
                                        <th style={{ border: "1px solid #999", padding: "8px" }}>Diagnosis / Notes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {petHistory.length > 0 ? petHistory.map(appt => (
                                        <tr key={appt.id}>
                                            <td style={{ border: "1px solid #ccc", padding: "8px" }}>{appt.date}</td>
                                            <td style={{ border: "1px solid #ccc", padding: "8px" }}>{appt.reason}</td>
                                            <td style={{ border: "1px solid #ccc", padding: "8px" }}>{appt.status}</td>
                                            <td style={{ border: "1px solid #ccc", padding: "8px" }}>{appt.diagnosis || appt.cancellationReason || "-"}</td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan="4" style={{ textAlign: "center", padding: "10px", border: "1px solid #ccc" }}>No medical history found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    );
                })}

                {/* === B. APPOINTMENT PRINT VIEW (NEW) === */}
                {recordTab === "appointments" && (
                    <div className="appointment-table-view">
                        <div style={{marginBottom: "15px", fontSize: "14px"}}>
                            <strong>Report Filters:</strong> Status: {recordStatus} | Service: {recordServiceFilter}
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th>Date / Time</th>
                                    <th>Pet Details</th>
                                    <th>Owner Details</th>
                                    <th>Service</th>
                                    <th>Status</th>
                                    <th>Diagnosis / Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRecordData.map(appt => {
                                    // Resolve owner based on ID attached to appointment (if available) or search by name
                                    const owner = users.find(u => u.id === appt.ownerId);
                                    // Find pet details if possible
                                    const pet = pets.find(p => p.id === appt.petId) || { species: "" };

                                    return (
                                        <tr key={appt.id}>
                                            <td style={{whiteSpace:"nowrap"}}>{appt.date}</td>
                                            <td>
                                                <strong>{appt.petName}</strong><br/>
                                                <span style={{fontSize:"10px", color:"#555"}}>{pet.species}</span>
                                            </td>
                                            <td>
                                                {owner ? (
                                                    <>
                                                        {owner.firstName} {owner.lastName}<br/>
                                                        <span style={{fontSize:"10px", color:"#555"}}>{owner.phone || owner.email}</span>
                                                    </>
                                                ) : "Unknown"}
                                            </td>
                                            <td>{appt.reason}</td>
                                            <td>{appt.status}</td>
                                            <td>{appt.diagnosis || appt.cancellationReason || "-"}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        <div style={{marginTop: "10px", textAlign: "right", fontWeight: "bold", fontSize: "12px"}}>
                            Total Records: {filteredRecordData.length}
                        </div>
                    </div>
                )}
                
                <div style={{ textAlign: "center", marginTop: "20px", fontSize: "10px", color: "#666" }}>
                    Generated by PawPals Admin System on {new Date().toLocaleDateString()}
                </div>
            </div>
        </div>

        {/* --- VIEW PET RECORD MODAL (EXISTING) --- */}
        {viewingRecord && (
             <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 }}>
                 <div style={{ background: "white", padding: "25px", borderRadius: "15px", width: "500px", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 10px 30px rgba(0,0,0,0.2)" }}>
                     <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", borderBottom: "1px solid #eee", paddingBottom: "15px", marginBottom: "15px" }}>
                        <h3 style={{ margin: 0, color: "#1976D2" }}>Pet & Owner Details</h3>
                        <span onClick={() => setViewingRecord(null)} style={{cursor:"pointer", color:"#999", fontSize:"20px", fontWeight:"bold"}}>×</span>
                     </div>
                     
                     <div style={{display:"grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px"}}>
                         {/* LEFT COLUMN: PET INFO */}
                         <div style={{ background: "#f9f9f9", padding: "10px", borderRadius: "8px" }}>
                            <h5 style={{margin: "0 0 10px 0", color: "#666"}}>🐾 Pet Information</h5>
                            <div style={{fontSize: "14px", marginBottom: "5px"}}><strong>Name:</strong> {viewingRecord.name}</div>
                            <div style={{fontSize: "14px", marginBottom: "5px"}}><strong>Species:</strong> {viewingRecord.species}</div>
                            <div style={{fontSize: "14px", marginBottom: "5px"}}><strong>Breed:</strong> {viewingRecord.breed || "Unknown"}</div>
                         </div>
                         
                         {/* RIGHT COLUMN: OWNER INFO */}
                         <div style={{ background: "#e3f2fd", padding: "10px", borderRadius: "8px" }}>
                             <h5 style={{margin: "0 0 10px 0", color: "#1565C0"}}>👤 Owner Information</h5>
                             {(() => {
                                 const owner = users.find(u => u.id === viewingRecord.ownerId);
                                 return owner ? (
                                     <>
                                        <div style={{fontSize: "14px", marginBottom: "5px"}}><strong>Name:</strong> {owner.firstName} {owner.lastName}</div>
                                        <div style={{fontSize: "14px", marginBottom: "5px"}}><strong>Phone:</strong> {owner.phone || "N/A"}</div>
                                        <div style={{fontSize: "14px", marginBottom: "5px"}}><strong>Address:</strong> {owner.address || "N/A"}</div>
                                     </>
                                 ) : <div style={{fontSize: "14px", color:"#999"}}>Owner not found</div>;
                             })()}
                         </div>
                     </div>

                     {/* MEDICAL HISTORY SECTION */}
                     <h5 style={{margin: "0 0 10px 0", color: "#333", borderBottom:"1px solid #eee", paddingBottom:"5px"}}>📋 Medical History (Appointments)</h5>
                     <div style={{ maxHeight: "200px", overflowY: "auto", border: "1px solid #eee", borderRadius: "4px" }}>
                         <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                            <thead style={{background: "#eee", position: "sticky", top: 0}}>
                                <tr>
                                    <th style={{padding: "8px", textAlign: "left"}}>Date</th>
                                    <th style={{padding: "8px", textAlign: "left"}}>Service</th>
                                    <th style={{padding: "8px", textAlign: "left"}}>Status</th>
                                    <th style={{padding: "8px", textAlign: "left"}}>Notes/Diagnosis</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(() => {
                                    const history = appointments.filter(a => a.petName === viewingRecord.name && a.ownerId === viewingRecord.ownerId);
                                    if (history.length === 0) return <tr><td colSpan="4" style={{padding:"15px", textAlign:"center", color:"#999"}}>No medical history recorded.</td></tr>;
                                    
                                    return history.map(appt => (
                                        <tr key={appt.id} style={{borderBottom: "1px solid #f0f0f0"}}>
                                            <td style={{padding: "8px"}}>{appt.date}</td>
                                            <td style={{padding: "8px"}}>{appt.reason}</td>
                                            <td style={{padding: "8px"}}>
                                                <span style={{ padding: "2px 6px", borderRadius: "4px", color: "white", fontSize: "10px", background: appt.status === "Done" ? "#2196F3" : (appt.status === "Cancelled" ? "red" : "green") }}>
                                                    {appt.status}
                                                </span>
                                            </td>
                                            <td style={{padding: "8px", color: "#555"}}>{appt.diagnosis || appt.cancellationReason || "-"}</td>
                                        </tr>
                                    ));
                                })()}
                            </tbody>
                         </table>
                     </div>

                     <button onClick={() => setViewingRecord(null)} style={{marginTop:"20px", width:"100%", background:"#607D8B", color:"white", border:"none", padding:"12px", borderRadius:"6px", cursor:"pointer", fontWeight:"bold"}}>Close Details</button>
                 </div>
             </div>
         )}
         
         {/* --- EDIT USER MODAL (EXISTING) --- */}
        {editingUser && (
             <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 }}>
                 <div style={{ background: "white", padding: "30px", borderRadius: "15px", width: "400px", boxShadow: "0 10px 30px rgba(0,0,0,0.2)" }}>
                     <h3 style={{ marginTop: 0, borderBottom: "1px solid #eee", paddingBottom: "10px" }}>Edit User</h3>
                     <form onSubmit={handleSaveUser} style={{display:"flex", flexDirection:"column", gap:"15px"}}>
                         <div><label style={{fontSize:"12px", fontWeight:"bold"}}>Email (Read-only)</label><input type="text" value={editingUser.email} disabled style={{width:"100%", background:"#f0f0f0", border:"1px solid #ccc", padding:"8px", borderRadius:"4px"}} /></div>
                         <div><label style={{fontSize:"12px", fontWeight:"bold"}}>First Name</label><input type="text" value={editFormData.firstName} onChange={e => setEditFormData({...editFormData, firstName: e.target.value})} required style={{width:"100%", padding:"8px", border:"1px solid #ccc", borderRadius:"4px"}} /></div>
                         <div><label style={{fontSize:"12px", fontWeight:"bold"}}>Last Name</label><input type="text" value={editFormData.lastName} onChange={e => setEditFormData({...editFormData, lastName: e.target.value})} required style={{width:"100%", padding:"8px", border:"1px solid #ccc", borderRadius:"4px"}} /></div>
                         <div style={{marginTop:"10px", padding:"10px", background:"#fff3e0", borderRadius:"8px", border:"1px solid #ffe0b2"}}><label style={{fontSize:"12px", fontWeight:"bold", display:"block", marginBottom:"5px", color:"#ef6c00"}}>Password Management</label><button type="button" onClick={handleSendResetEmail} style={{width:"100%", background:"#ff9800", color:"white", border:"none", padding:"8px", borderRadius:"4px", cursor:"pointer", fontSize:"13px"}}>📧 Send Password Reset Email</button></div>
                         <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}><button type="submit" className="action-btn" style={{ background: "#2196F3", color: "white", flex: 1 }}>Save Changes</button><button type="button" onClick={() => setEditingUser(null)} className="action-btn" style={{ background: "#ccc", color: "black", flex: 1 }}>Cancel</button></div>
                     </form>
                 </div>
             </div>
         )}

         {/* --- CONFIRMATION / ALERT MODAL (EXISTING) --- */}
         {modal.show && (
            <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 }}>
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

      </main>
    </div>
  );
};

export default AdminDashboard;
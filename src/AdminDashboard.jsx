import { useEffect, useState } from "react";
import { auth, db } from "./firebase";
import { signOut, sendPasswordResetEmail } from "firebase/auth";
import { collection, onSnapshot, doc, query, orderBy, updateDoc } from "firebase/firestore"; 
import { useNavigate } from "react-router-dom";
import logoImg from './logo.png'; 

// --- PROFESSIONAL SVG BAR CHART COMPONENT ---
const SimpleBarChart = ({ data, title }) => {
    // Adjusted dimensions for side-column fit
    const height = 300; 
    const width = 400; // Narrower width for side layout
    const padding = 40;
    const chartWidth = width - (padding * 2);
    const chartHeight = height - (padding * 2);
    
    const maxValue = Math.max(...data.map(d => d.value), 1);
    const barWidth = (chartWidth / data.length) * 0.6; 
    const gap = (chartWidth / data.length) * 0.4; 

    const [hoverIndex, setHoverIndex] = useState(null);

    return (
        <div style={{ background: "white", padding: "15px", borderRadius: "12px", boxShadow: "0 2px 5px rgba(0,0,0,0.05)", height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", border: "1px solid #eee" }}>
            <h4 style={{ margin: "0 0 10px 0", color: "#333", borderBottom:"1px solid #f0f0f0", paddingBottom:"10px", fontSize: "16px", textAlign: "center" }}>📊 {title}</h4>
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", maxHeight: "100%" }}>
                    {/* Grid Lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((tick, i) => {
                        const y = padding + chartHeight - (chartHeight * tick);
                        return (
                            <g key={i}>
                                <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#eee" strokeWidth="1" strokeDasharray="4" />
                                <text x={padding - 10} y={y + 4} textAnchor="end" fontSize="10" fill="#999">{Math.round(maxValue * tick)}</text>
                            </g>
                        );
                    })}
                    {/* Bars */}
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
  
  // Filters
  const [userTab, setUserTab] = useState("owner");
  const [userSearch, setUserSearch] = useState("");
  const [petSearch, setPetSearch] = useState("");
  const [speciesFilter, setSpeciesFilter] = useState("All");
  
  // Records Tab
  const [recordTab, setRecordTab] = useState("pets");
  const [recordPetSearch, setRecordPetSearch] = useState("");
  const [recordStartDate, setRecordStartDate] = useState("");
  const [recordEndDate, setRecordEndDate] = useState("");
  const [recordStatus, setRecordStatus] = useState("Done");

  // Edit User
  const [editingUser, setEditingUser] = useState(null);
  const [editFormData, setEditFormData] = useState({ firstName: "", lastName: "" });

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

  const handleLogout = async () => { await signOut(auth); navigate("/"); };

  const handleToggleUserStatus = async (userId, currentStatus) => {
      const newStatus = !currentStatus; 
      const action = newStatus ? "Disable" : "Enable";
      if(window.confirm(`Are you sure you want to ${action} this account?`)) {
          await updateDoc(doc(db, "users", userId), { isDisabled: newStatus });
      }
  };

  const handleEditUser = (user) => { setEditingUser(user); setEditFormData({ firstName: user.firstName, lastName: user.lastName }); };
  const handleSaveUser = async (e) => {
      e.preventDefault();
      if(editingUser) {
          await updateDoc(doc(db, "users", editingUser.id), { firstName: editFormData.firstName, lastName: editFormData.lastName });
          setEditingUser(null);
      }
  };
  const handleSendResetEmail = async () => {
      if(editingUser && editingUser.email) {
          try { await sendPasswordResetEmail(auth, editingUser.email); alert(`Password reset email sent to ${editingUser.email}`); } 
          catch (error) { alert("Error sending email: " + error.message); }
      }
  };

  // Pet Actions
  const handleManualArchive = async (id) => { if(window.confirm("Archive this pet?")) await updateDoc(doc(db, "pets", id), { isArchived: true }); };
  const handleApproveDeletion = async (pet) => { if(window.confirm(`Approve deletion?`)) await updateDoc(doc(db, "pets", pet.id), { isArchived: true, deletionStatus: "Approved" }); };
  const handleRejectDeletion = async (petId) => { if(window.confirm("Reject request?")) await updateDoc(doc(db, "pets", petId), { isArchived: false, deletionStatus: null, deletionReason: null }); };
  const handleRestorePet = async (id) => { if(window.confirm("Restore pet?")) await updateDoc(doc(db, "pets", id), { isArchived: false, deletionStatus: null, deletionReason: null }); };

  // --- FILTERS ---
  const getFilteredUsers = () => {
      let filtered = users.filter(u => 
        (u.firstName?.toLowerCase().includes(userSearch.toLowerCase()) || 
         u.lastName?.toLowerCase().includes(userSearch.toLowerCase()) || 
         u.email?.toLowerCase().includes(userSearch.toLowerCase()))
      );
      return userTab === "disabled" ? filtered.filter(u => u.isDisabled === true) : filtered.filter(u => u.role === userTab && !u.isDisabled);
  };

  const filteredPets = pets.filter(p => 
      (p.name.toLowerCase().includes(petSearch.toLowerCase()) || 
      users.find(u=>u.id===p.ownerId)?.firstName.toLowerCase().includes(petSearch.toLowerCase())) &&
      (speciesFilter === "All" || p.species === speciesFilter)
  );

  const getFilteredRecords = () => {
      let data = recordTab === "pets" ? pets : appointments;
      if (recordTab === "appointments" && (recordStartDate || recordEndDate)) {
           data = data.filter(item => {
               const itemDate = new Date(item.date);
               const start = recordStartDate ? new Date(recordStartDate) : new Date('1900-01-01');
               const end = recordEndDate ? new Date(recordEndDate) : new Date('2100-01-01');
               return itemDate >= start && itemDate <= end;
           });
      }
      if (recordTab === "appointments" && recordStatus !== "All") data = data.filter(a => a.status === recordStatus);
      const search = recordPetSearch.toLowerCase();
      if (recordTab === "pets") return data.filter(p => p.name.toLowerCase().includes(search));
      return data.filter(a => a.petName.toLowerCase().includes(search));
  };

  const filteredRecordData = getFilteredRecords();

  // Static Graph Data
  const breedChartData = (() => {
      const counts = {};
      const source = pets; 
      source.forEach(p => { const b = p.breed || "Unknown"; counts[b] = (counts[b] || 0) + 1; });
      return Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8) 
          .map(([label, value]) => ({ label, value }));
  })();

  const getTabStyle = (name) => ({
      padding: "15px",
      fontSize: "1.1rem",
      cursor: "pointer",
      border: "none",
      borderRadius: "12px",
      background: activeView === name ? "#2196F3" : "white",
      color: activeView === name ? "white" : "#555",
      boxShadow: activeView === name ? "0 4px 10px rgba(33, 150, 243, 0.4)" : "0 2px 4px rgba(0,0,0,0.05)",
      fontWeight: "bold",
      transition: "all 0.2s",
      width: "100%",
      textAlign: "center"
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
                        <select value={speciesFilter} onChange={e => setSpeciesFilter(e.target.value)} style={{padding:"8px", borderRadius:"5px"}}><option value="All">All Species</option><option value="Dog">Dogs</option><option value="Cat">Cats</option><option value="Other">Others</option></select>
                    </div>
                    <input type="text" placeholder="🔍 Search Pet or Owner..." value={petSearch} onChange={e => setPetSearch(e.target.value)} style={{marginBottom:"15px", padding:"10px", borderRadius:"20px", border:"1px solid #ddd", width:"300px", flexShrink: 0}} />
                    <div style={{flex: 1, overflowY: "auto"}}>
                        <table style={{width: "100%", borderCollapse: "collapse"}}>
                            <thead><tr style={{background:"#f9f9f9", textAlign:"left"}}><th style={{padding:"10px"}}>Pet Name</th><th>Species</th><th>Breed</th><th>Owner</th><th>Actions</th></tr></thead>
                            <tbody>
                                {filteredPets.map(p => {
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
                // --- SIDE-BY-SIDE LAYOUT WRAPPER ---
                <div style={{ display: "flex", gap: "20px", height: "100%", overflow: "hidden" }}>
                    
                    {/* LEFT COLUMN: GRAPH (Only shows when PETS selected) */}
                    {recordTab === "pets" && (
                        <div style={{ flex: "0 0 35%", minWidth: "300px", height: "100%" }}>
                             {breedChartData.length > 0 ? (
                                <SimpleBarChart data={breedChartData} title="Breed Distribution" />
                             ) : (
                                <div className="card" style={{height:"100%", display:"flex", alignItems:"center", justifyContent:"center", color:"#888"}}>No Data Available</div>
                             )}
                        </div>
                    )}

                    {/* RIGHT COLUMN: CONTROLS & TABLE */}
                    <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", padding: "20px", boxSizing: "border-box", overflow: "hidden" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px", flexShrink: 0 }}>
                            <h3>System Records</h3>
                            <div style={{ display: "flex", background: "#f1f1f1", borderRadius: "20px", padding: "2px" }}>
                                <button onClick={() => setRecordTab("pets")} style={{ background: recordTab === "pets" ? "white" : "transparent", border: "none", borderRadius: "18px", padding: "6px 20px", cursor: "pointer", fontWeight: "bold", boxShadow: recordTab === "pets" ? "0 2px 4px rgba(0,0,0,0.1)" : "none" }}>Pets</button>
                                <button onClick={() => setRecordTab("appointments")} style={{ background: recordTab === "appointments" ? "white" : "transparent", border: "none", borderRadius: "18px", padding: "6px 20px", cursor: "pointer", fontWeight: "bold", boxShadow: recordTab === "appointments" ? "0 2px 4px rgba(0,0,0,0.1)" : "none" }}>Appointments</button>
                            </div>
                        </div>

                        {/* Filters */}
                        <div style={{ display: "flex", gap: "10px", marginBottom: "15px", flexWrap: "wrap", padding: "10px", background: "#f9f9f9", borderRadius: "8px", flexShrink: 0 }}>
                            <input type="text" placeholder={recordTab === "pets" ? "Search Pet..." : "Search Client/Pet..."} value={recordPetSearch} onChange={e => setRecordPetSearch(e.target.value)} style={{ padding: "8px", borderRadius: "5px", border: "1px solid #ccc", flex: 1 }} />
                            {recordTab === "appointments" && (
                                <>
                                    <select value={recordStatus} onChange={e => setRecordStatus(e.target.value)} style={{ padding: "8px", borderRadius: "5px", border: "1px solid #ccc" }}>
                                        <option value="All">All Statuses</option>
                                        <option value="Done">Completed</option>
                                        <option value="Approved">Approved</option>
                                        <option value="Cancelled">Cancelled</option>
                                    </select>
                                    <input type="date" value={recordStartDate} onChange={e => setRecordStartDate(e.target.value)} style={{ padding: "8px", borderRadius: "5px", border: "1px solid #ccc" }} />
                                    <input type="date" value={recordEndDate} onChange={e => setRecordEndDate(e.target.value)} style={{ padding: "8px", borderRadius: "5px", border: "1px solid #ccc" }} />
                                </>
                            )}
                            <button onClick={() => window.print()} style={{ background: "#607D8B", color: "white", border: "none", padding: "8px 15px", borderRadius: "5px", cursor: "pointer" }}>🖨️ Print</button>
                        </div>

                        {/* Table */}
                        <div style={{ flex: 1, overflowY: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                                <thead>
                                    <tr style={{ background: "#eee", textAlign: "left" }}>
                                        {recordTab === "pets" ? (
                                            <><th>Pet Name</th><th>Species</th><th>Breed</th><th>Owner</th><th>Date</th></>
                                        ) : (
                                            <><th>Date</th><th>Pet</th><th>Service</th><th>Status</th><th>Notes</th></>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRecordData.length === 0 ? <tr><td colSpan="5" style={{ textAlign: "center", padding: "20px" }}>No records found.</td></tr> : filteredRecordData.map(item => {
                                        if (recordTab === "pets") {
                                            const owner = users.find(u => u.id === item.ownerId);
                                            return (
                                                <tr key={item.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                                                    <td style={{ padding: "8px" }}>{item.name}</td><td>{item.species}</td><td>{item.breed}</td>
                                                    <td>{owner ? `${owner.firstName} ${owner.lastName}` : "Unknown"}</td>
                                                    <td>{item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString() : "N/A"}</td>
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
      </main>
    </div>
  );
};

export default AdminDashboard;
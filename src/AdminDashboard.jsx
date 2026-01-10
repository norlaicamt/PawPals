// src/AdminDashboard.jsx
import { useEffect, useState } from "react";
import { auth, db } from "./firebase";
import { signOut } from "firebase/auth";
import { collection, onSnapshot, doc, query, orderBy, updateDoc, deleteDoc, getDoc } from "firebase/firestore"; 
import { useNavigate } from "react-router-dom";
import logoImg from "./assets/logo.png"; 

// --- PROFESSIONAL SVG BAR CHART COMPONENT WITH LEGEND ---
const SimpleBarChart = ({ data, title, hideLabels = false }) => {
    const height = 350; 
    const width = 600; 
    const padding = 50;
    const chartWidth = width - (padding * 2);
    const chartHeight = height - (padding * 2.5);
    
    const maxValue = Math.max(...data.map(d => d.value), 1);
    const gap = (chartWidth / data.length) * 0.4; 
    const barWidth = (chartWidth / data.length) * 0.6;

    const [hoverIndex, setHoverIndex] = useState(null);
    const colors = ["#FF5722", "#2196F3", "#4CAF50", "#FFC107", "#9C27B0", "#00BCD4", "#795548", "#607D8B"];

    return (
        <div className="no-print" style={{ background: "white", padding: "15px", borderRadius: "12px", height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", border: "1px solid #eee" }}>
            <h4 style={{ margin: "0 0 10px 0", color: "#333", borderBottom:"1px solid #f0f0f0", paddingBottom:"10px", fontSize: "18px", textAlign: "center" }}>📊 {title}</h4>
            
            {!hideLabels && (
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "15px", marginBottom: "15px", padding: "0 10px" }}>
                    {data.map((d, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#555" }}>
                            <div style={{ width: "12px", height: "12px", background: colors[i % colors.length], borderRadius: "3px" }}></div>
                            <span style={{ fontWeight: "500" }}>{d.label}</span>
                        </div>
                    ))}
                </div>
            )}

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
                        const barColor = colors[i % colors.length];

                        return (
                            <g key={i} onMouseEnter={() => setHoverIndex(i)} onMouseLeave={() => setHoverIndex(null)}>
                                <rect 
                                    x={x} y={y} width={barWidth} height={barH} 
                                    fill={hoverIndex === i ? "#333" : barColor} 
                                    rx="4" style={{ transition: "all 0.2s" }}
                                />
                                <text x={x + barWidth / 2} y={y - 5} textAnchor="middle" fontSize="11" fontWeight="bold" fill="#333">{d.value}</text>
                                {!hideLabels && (
                                    <text 
                                        x={x + barWidth / 2} y={height - padding + 15} textAnchor="end" fontSize="10" 
                                        fill={hoverIndex === i ? "#000" : "#666"}
                                        transform={`rotate(-45, ${x + barWidth / 2}, ${height - padding + 15})`}
                                    >
                                        {d.label.length > 8 ? d.label.substring(0, 6) + "..." : d.label}
                                    </text>
                                )}
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
  const [reactivationRequests, setReactivationRequests] = useState([]);

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

  // Archive Tab
  const [archiveTab, setArchiveTab] = useState("requests"); 

  // Detailed Record View
  const [viewingRecord, setViewingRecord] = useState(null);

  // PRINT STATES
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedPetsForPrint, setSelectedPetsForPrint] = useState([]);
  const [isPrintingAppointments, setIsPrintingAppointments] = useState(false);

  // CHART MODAL STATE
  const [showChartModal, setShowChartModal] = useState(false);

  // --- CUSTOM BOX MODAL STATE ---
  const [modal, setModal] = useState({
      show: false, title: "", message: "", type: "confirm", inputValue: "", onConfirm: null 
  });

  // --- DATA FETCHING ---
  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => setUsers(snap.docs.map(d => ({...d.data(), id: d.id}))));
    
    const unsubPets = onSnapshot(collection(db, "pets"), (snap) => {
        const allPets = snap.docs.map(d => ({...d.data(), id: d.id}));
        // Active: Not archived, not pending deletion
        setPets(allPets.filter(p => !p.isArchived && p.deletionStatus !== "Pending"));
        // Archive: Archived OR Pending Deletion
        setArchivedPets(allPets.filter(p => p.isArchived || p.deletionStatus === "Pending"));
    });

    const unsubAppts = onSnapshot(query(collection(db, "appointments"), orderBy("date", "desc")), (snap) => setAppointments(snap.docs.map(d => ({...d.data(), id: d.id}))));
    
    // FETCH ALL EDIT REQUESTS (Includes standard edits AND pet_restore requests)
    const unsubRequests = onSnapshot(collection(db, "edit_requests"), (snap) => {
      setRequests(snap.docs.map(d => ({ ...d.data(), id: d.id })));
    });

    const unsubReactivation = onSnapshot(collection(db, "reactivation_requests"), (snap) => {
        setReactivationRequests(snap.docs.map(d => ({ ...d.data(), id: d.id })));
    });

    return () => { unsubUsers(); unsubPets(); unsubAppts(); unsubRequests(); unsubReactivation(); };
  }, []);

  // --- FILTER REQUESTS ---
  // 1. Restore Requests: Owners asking to reactivate an archived pet (type = 'pet_restore')
  const restoreRequests = requests.filter(r => r.type === 'pet_restore');
  // 2. General Requests: Standard inventory/pet detail edits (type != 'pet_restore')
  const generalRequests = requests.filter(r => r.type !== 'pet_restore');

  const stats = {
    totalOwners: users.filter(u => u.role === "owner" && !u.isDisabled).length,
    totalPets: pets.length,
    totalAppointments: appointments.length,
    pendingDeletions: archivedPets.filter(p => p.deletionStatus === "Pending").length,
    completedAppointments: appointments.filter(a => a.status === "Done").length
  };

  // --- HELPER: CUSTOM MODAL HANDLERS ---
  const closeModal = () => setModal({ ...modal, show: false, inputValue: "" });
  
  const confirmAction = (title, message, action) => { 
      setModal({ show: true, title, message, type: "confirm", onConfirm: action, inputValue: "" }); 
  };
  
  const showAlert = (title, message) => { 
      setModal({ show: true, title, message, type: "alert", onConfirm: closeModal, inputValue: "" }); 
  };

  const inputAction = (title, message, action) => {
      setModal({ show: true, title, message, type: "input", onConfirm: action, inputValue: "" });
  };

  // --- ACTION LOGIC ---

  const handleLogout = () => { 
      confirmAction("Logout", "Are you sure you want to log out?", async () => { 
          await signOut(auth); 
          navigate("/"); 
          closeModal();
      });
  };

  const handleToggleUserStatus = (user) => {
      const isDisabling = !user.isDisabled; 
      if (isDisabling) {
          inputAction("Disable Account", "Please provide a reason. This will be sent to the owner.", async (reason) => {
            if(!reason || reason.trim() === "") {
                showAlert("Error", "Reason is required.");
                return;
            }
            await updateDoc(doc(db, "users", user.id), { isDisabled: true, disableReason: reason });
            closeModal();
            showAlert("Success", `Account disabled.`);
          });
      } else {
          const request = reactivationRequests.find(req => req.email === user.email);
          let message = "Enable this account?";
          if (request) {
              message = `User requested reactivation.\nReason: "${request.reason}"\n\nApprove and Enable?`;
          }

          confirmAction("Enable Account", message, async () => {
              try {
                  await updateDoc(doc(db, "users", user.id), { isDisabled: false, disableReason: null });
                  if (request && request.id) {
                      await deleteDoc(doc(db, "reactivation_requests", request.id));
                  }
                  closeModal();
                  showAlert("Success", "Account Reactivated Successfully.");
              } catch (err) {
                  console.error(err);
                  showAlert("Error", "Could not enable account.");
              }
          });
      }
  };

  const handleManualArchive = (id) => { 
      inputAction("Archive Pet", "Please enter a reason for archiving this pet. The owner will be notified.", async (reason) => {
          if(!reason) return; 
          await updateDoc(doc(db, "pets", id), { 
              isArchived: true,
              archiveReason: reason, 
              archivedAt: new Date()
          });
          closeModal();
          showAlert("Archived", "Pet has been moved to the archive list.");
      });
  };

  const handleApproveDeletion = (pet) => { 
      confirmAction("Approve Deletion", "Permanently archive this pet?", async () => {
          await updateDoc(doc(db, "pets", pet.id), { isArchived: true, deletionStatus: "Approved" });
          closeModal();
      });
  };

  const handleRejectDeletion = (petId) => { 
      confirmAction("Reject Request", "Restore pet to active list?", async () => {
          await updateDoc(doc(db, "pets", petId), { isArchived: false, deletionStatus: null, deletionReason: null });
          closeModal();
      });
  };

  const handleRestorePet = (id) => { 
      confirmAction("Restore Pet", "Restore this pet to the active list?", async () => {
          await updateDoc(doc(db, "pets", id), { 
              isArchived: false, 
              deletionStatus: null, 
              deletionReason: null,
              archiveReason: null 
          });
          closeModal();
      });
  };

  // --- REACTIVATION HANDLERS (New) ---
  const handleApproveReactivation = (req) => {
    confirmAction("Approve Reactivation", "Approve request and restore this pet to the active list?", async () => {
        try {
            // Restore pet, remove archive flags
            // ADDED: reactivationAlert: true -> Ensures owner gets a notification even if offline
            await updateDoc(doc(db, "pets", req.petId), { 
                isArchived: false, 
                archiveReason: null,
                deletionStatus: null, 
                deletionReason: null,
                reactivationAlert: true 
            });
            // Delete request
            await deleteDoc(doc(db, "edit_requests", req.id));
            closeModal();
            showAlert("Success", "Pet restored to active list!");
        } catch (error) {
            console.error(error);
            showAlert("Error", "Failed to restore pet.");
        }
    });
  };

  const handleRejectReactivation = (reqId) => {
    confirmAction("Reject Reactivation", "Reject this reactivation request? The pet will remain archived.", async () => {
        await deleteDoc(doc(db, "edit_requests", reqId));
        closeModal();
        showAlert("Rejected", "Request removed. Pet remains archived.");
    });
  };

  // --- GENERAL EDIT REQUEST HANDLERS ---
  const handleApproveRequest = async (req) => {
    confirmAction("Approve Update", "Approve these changes?", async () => {
        try {
            const collectionName = req.type === 'inventory' ? 'inventory' : 'pets';
            const itemRef = doc(db, collectionName, req.itemId || req.petId);
            const itemSnap = await getDoc(itemRef);
            if (!itemSnap.exists()) {
                closeModal();
                showAlert("Error", "Item/Pet no longer exists.");
                await deleteDoc(doc(db, "edit_requests", req.id));
                return;
            }
            await updateDoc(itemRef, req.newData);
            await deleteDoc(doc(db, "edit_requests", req.id));
            closeModal();
            showAlert("Success", "Record updated successfully.");
        } catch (error) {
            console.error(error);
            closeModal();
            showAlert("Error", "Failed to update.");
        }
    });
};

const handleRejectRequest = async (reqId) => {
    confirmAction("Reject Update", "Reject this edit request?", async () => {
        await deleteDoc(doc(db, "edit_requests", reqId));
        closeModal();
        showAlert("Rejected", "Request removed.");
    });
};

  // --- PRINT & FILTERS ---
  const togglePetSelection = (petId) => {
      setSelectedPetsForPrint(prev => prev.includes(petId) ? prev.filter(id => id !== petId) : [...prev, petId]);
  };

  const handleSelectAllForPrint = () => {
      const currentPets = pets.sort((a, b) => a.name.localeCompare(b.name));
      setSelectedPetsForPrint(selectedPetsForPrint.length === currentPets.length ? [] : currentPets.map(p => p.id));
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

  const uniqueServices = [...new Set(appointments.map(a => a.reason).filter(Boolean))].sort();

  const getFilteredUsers = () => {
      let filtered = users.filter(u => 
        (u.firstName?.toLowerCase().includes(userSearch.toLowerCase()) || 
         u.lastName?.toLowerCase().includes(userSearch.toLowerCase()) || 
         u.email?.toLowerCase().includes(userSearch.toLowerCase()))
      );
      if (userTab === "disabled") return filtered.filter(u => u.isDisabled === true);
      else if (userTab === "staff_admin") return filtered.filter(u => (u.role === "admin" || u.role === "staff") && !u.isDisabled);
      return filtered.filter(u => u.role === userTab && !u.isDisabled);
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
      return (recordStatus === "All" || a.status === recordStatus) && 
             (recordServiceFilter === "All" || a.reason === recordServiceFilter);
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

  const handleOverviewClick = (view, subTab) => {
    setActiveView(view);
    if(subTab && view === 'accounts') setUserTab(subTab);
  };

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
                    <div onClick={() => handleOverviewClick('accounts', 'owner')} className="card" style={{ cursor: "pointer", background: "white", borderRadius: "12px", padding: "20px", borderLeft: "5px solid #2196F3", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                        <span style={{ color: "#666", fontSize: "14px", fontWeight: "bold" }}>Total Registered Owners</span>
                        <div style={{ fontSize: "28px", fontWeight: "bold", marginTop: "5px" }}>{stats.totalOwners}</div>
                    </div>
                    <div onClick={() => handleOverviewClick('pets')} className="card" style={{ cursor: "pointer", background: "white", borderRadius: "12px", padding: "20px", borderLeft: "5px solid #4CAF50", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                        <span style={{ color: "#666", fontSize: "14px", fontWeight: "bold" }}>Total Active Pets</span>
                        <div style={{ fontSize: "28px", fontWeight: "bold", marginTop: "5px" }}>{stats.totalPets}</div>
                    </div>
                    <div onClick={() => handleOverviewClick('records')} className="card" style={{ cursor: "pointer", background: "white", borderRadius: "12px", padding: "20px", borderLeft: "5px solid #9C27B0", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                        <span style={{ color: "#666", fontSize: "14px", fontWeight: "bold" }}>Total Appointments</span>
                        <div style={{ fontSize: "28px", fontWeight: "bold", marginTop: "5px" }}>{stats.totalAppointments}</div>
                    </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", flex: 1, minHeight: "350px" }}>
                    <div style={{background: "white", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", overflow: "hidden", position: "relative"}}>
                        <SimpleBarChart data={breedChartData} title="Pet Breed Distribution" hideLabels={true} />
                        <button 
                            onClick={() => setShowChartModal(true)}
                            style={{ position: "absolute", bottom: "15px", right: "15px", padding: "8px 15px", background: "#2196F3", color: "white", border: "none", borderRadius: "20px", cursor: "pointer", fontWeight: "bold", fontSize: "12px", boxShadow: "0 2px 5px rgba(0,0,0,0.2)" }}
                        >
                            VIEW FULL CHART
                        </button>
                    </div>
                    <div className="card" style={{ background: "white", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", padding: "20px" }}>
                        <h4 style={{ margin: "0 0 15px 0", borderBottom: "1px solid #eee", paddingBottom: "10px", color: "#333" }}>System Quick Stats</h4>
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "15px", background: "#f9f9f9", borderRadius: "8px", border: "1px solid #eee" }}>
                                <span>Pending Edit Requests</span>
                                {/* Updated to show only general requests count */}
                                <b style={{ color: generalRequests.length > 0 ? "orange" : "#333" }}>{generalRequests.length}</b>
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
              <div style={{ padding: "20px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button onClick={() => setUserTab("owner")} style={{ padding: "8px 16px", borderRadius: "20px", border: "none", background: userTab === "owner" ? "#2196F3" : "#f1f1f1", color: userTab === "owner" ? "white" : "#666", cursor: "pointer", fontWeight: "bold" }}>Pet Owners</button>
                  <button onClick={() => setUserTab("staff_admin")} style={{ padding: "8px 16px", borderRadius: "20px", border: "none", background: userTab === "staff_admin" ? "#2196F3" : "#f1f1f1", color: userTab === "staff_admin" ? "white" : "#666", cursor: "pointer", fontWeight: "bold" }}>Staff/Admin</button>
                  <button onClick={() => setUserTab("disabled")} style={{ padding: "8px 16px", borderRadius: "20px", border: "none", background: userTab === "disabled" ? "#d32f2f" : "#ffebee", color: userTab === "disabled" ? "white" : "#d32f2f", cursor: "pointer", fontWeight: "bold" }}>Disabled</button>
                </div>
                <input type="text" placeholder="Search accounts..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} style={{ width: "250px", padding: "10px", border: "1px solid #ddd", borderRadius: "8px" }} />
              </div>
              <div style={{ flex: 1, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead style={{ position: "sticky", top: 0, background: "white" }}>
                    <tr style={{ textAlign: "left", color: "#666" }}>
                        <th style={{ padding: "15px" }}>Name</th>
                        <th style={{ padding: "15px" }}>Email</th>
                        <th style={{ padding: "15px" }}>Status</th>
                        <th style={{ padding: "15px" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredUsers().map(user => {
                      const hasReactivationRequest = reactivationRequests.some(req => req.email === user.email);
                      return (
                      <tr key={user.id} style={{ borderBottom: "1px solid #f1f1f1", background: hasReactivationRequest ? "#fff3e0" : "transparent" }}>
                        <td style={{ padding: "15px", fontWeight: "bold" }}>{user.firstName} {user.lastName}</td>
                        <td style={{ padding: "15px" }}>{user.email}</td>
                        <td style={{ padding: "15px" }}>
                          <span style={{ padding: "4px 10px", borderRadius: "12px", fontSize: "12px", background: user.isDisabled ? "#ffebee" : "#e8f5e9", color: user.isDisabled ? "#d32f2f" : "#2e7d32", fontWeight: "bold" }}>
                            {user.isDisabled ? "Disabled" : "Active"}
                          </span>
                          {hasReactivationRequest && <div style={{ color: "#ef6c00", fontSize: "11px", fontWeight: "bold", marginTop: "4px" }}>⚠️ Request Pending</div>}
                        </td>
                        <td style={{ padding: "15px" }}>
                          <button onClick={() => handleToggleUserStatus(user)} style={{ padding: "6px 12px", fontSize: "12px", background: user.isDisabled ? "#4CAF50" : "#f44336", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}>
                              {user.isDisabled ? "Enable" : "Disable"}
                          </button>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* --- PETS LIST VIEW --- */}
          {activeView === "pets" && (
            <div className="card no-print" style={{ background: "white", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", height: "100%", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "20px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <h3 style={{ margin: 0 }}>Active Pets</h3>
                  <select value={speciesFilter} onChange={(e) => setSpeciesFilter(e.target.value)} style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #ccc", marginLeft: "15px" }}>
                    <option value="All">All Species</option>
                    <option value="Dog">Dogs</option>
                    <option value="Cat">Cats</option>
                    <option value="Other">Others</option>
                  </select>
                </div>
                <input type="text" placeholder="Search pet or owner..." value={petSearch} onChange={(e) => setPetSearch(e.target.value)} style={{ width: "250px", padding: "10px", border: "1px solid #ddd", borderRadius: "8px" }} />
              </div>
              <div style={{ flex: 1, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead style={{ position: "sticky", top: 0, background: "white" }}>
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
              <div style={{ padding: "20px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button onClick={() => setRecordTab("pets")} style={{ padding: "10px 20px", borderRadius: "20px", border: "none", background: recordTab === "pets" ? "#2196F3" : "#f5f5f5", color: recordTab === "pets" ? "white" : "#666", cursor: "pointer", fontWeight: "bold" }}>Pet History</button>
                  <button onClick={() => setRecordTab("appointments")} style={{ padding: "10px 20px", borderRadius: "20px", border: "none", background: recordTab === "appointments" ? "#2196F3" : "#f5f5f5", color: recordTab === "appointments" ? "white" : "#666", cursor: "pointer", fontWeight: "bold" }}>Appointment History</button>
                </div>
                <button onClick={handlePrintButtonClick} style={{ background: "#4CAF50", color: "white", padding: "10px 25px", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" }}>Print Report</button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
                {recordTab === "pets" ? (
                  <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "20px", height: "100%" }}>
                    <div style={{ background: "#f9f9f9", borderRadius: "12px", display: "flex", flexDirection: "column", overflow: "hidden", border: "1px solid #eee" }}>
                        <div style={{ padding: "15px", borderBottom: "1px solid #ddd" }}>
                            <input type="text" placeholder="Search pet name..." value={recordPetSearch} onChange={(e) => setRecordPetSearch(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ccc", boxSizing: "border-box" }} />
                        </div>
                        <div style={{ flex: 1, overflowY: "auto" }}>
                            {sortedPetsForRecords.map(pet => (
                                <div key={pet.id} onClick={() => setViewingRecord(pet)} style={{ padding: "15px", borderBottom: "1px solid #eee", cursor: "pointer", background: viewingRecord?.id === pet.id ? "#e3f2fd" : "transparent" }}>
                                    <div style={{ fontWeight: "bold", color: "#333" }}>{pet.name}</div>
                                    <div style={{ fontSize: "12px", color: "#666" }}>Owner: {users.find(u => u.id === pet.ownerId)?.firstName}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div style={{ background: "white", borderRadius: "12px", padding: "25px", border: "1px solid #eee", overflowY: "auto" }}>
                        {viewingRecord ? (
                            <div>
                                <h2 style={{ margin: "0 0 5px 0", color: "#2196F3" }}>{viewingRecord.name}</h2>
                                <p style={{ margin: "0 0 20px 0", color: "#666" }}>{viewingRecord.species} • {viewingRecord.breed}</p>
                                <h3 style={{ borderBottom: "1px solid #eee", paddingBottom: "10px" }}>Medical History</h3>
                                {appointments.filter(a => a.petId === viewingRecord.id && a.status === "Done").map(appt => (
                                    <div key={appt.id} style={{ padding: "10px", borderBottom: "1px solid #f9f9f9" }}>
                                        <b>{appt.date}</b> - {appt.reason} <span style={{color: "#888"}}>({appt.notes || "No notes"})</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ textAlign: "center", color: "#aaa", marginTop: "50px" }}>Select a pet to view history</div>
                        )}
                    </div>
                  </div>
                ) : (
                  <div style={{ background: "white", borderRadius: "12px", border: "1px solid #eee" }}>
                      
                      {/* FILTER DROPDOWNS */}
                      <div style={{ padding: "15px", borderBottom: "1px solid #eee", display: "flex", gap: "15px", background: "#f9f9f9", alignItems: "center" }}>
                        <span style={{ fontSize: "14px", fontWeight: "bold", color: "#555" }}>Filter By:</span>
                        <select value={recordStatus} onChange={(e) => setRecordStatus(e.target.value)} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}>
                            <option value="All">All Statuses</option>
                            <option value="Pending">Pending</option>
                            <option value="Confirmed">Confirmed</option>
                            <option value="Done">Done</option>
                            <option value="Cancelled">Cancelled</option>
                        </select>

                        <select value={recordServiceFilter} onChange={(e) => setRecordServiceFilter(e.target.value)} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}>
                            <option value="All">All Services</option>
                            {uniqueServices.map(service => (
                                <option key={service} value={service}>{service}</option>
                            ))}
                        </select>
                      </div>

                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <thead>
                              <tr style={{ background: "#f5f5f5", textAlign: "left" }}>
                                  <th style={{ padding: "12px" }}>Date</th>
                                  <th style={{ padding: "12px" }}>Owner</th>
                                  <th style={{ padding: "12px" }}>Pet</th>
                                  <th style={{ padding: "12px" }}>Service</th>
                                  <th style={{ padding: "12px" }}>Status</th>
                              </tr>
                          </thead>
                          <tbody>
                              {filteredAppointments.length === 0 ? (
                                  <tr><td colSpan="5" style={{ padding: "20px", textAlign: "center", color: "#999" }}>No appointments found.</td></tr>
                              ) : (
                                  filteredAppointments.map(appt => (
                                      <tr key={appt.id} style={{ borderBottom: "1px solid #eee" }}>
                                          <td style={{ padding: "12px" }}>{appt.date}</td>
                                          <td style={{ padding: "12px" }}>{users.find(u => u.id === appt.userId)?.firstName}</td>
                                          <td style={{ padding: "12px" }}>{pets.find(p => p.id === appt.petId)?.name || "Unknown"}</td>
                                          <td style={{ padding: "12px" }}>{appt.reason}</td>
                                          <td style={{ padding: "12px" }}>
                                            <span style={{ padding: "4px 8px", borderRadius: "4px", fontSize: "12px", background: appt.status === 'Done' ? '#e8f5e9' : appt.status === 'Pending' ? '#fff3e0' : '#eee', color: appt.status === 'Done' ? '#2e7d32' : appt.status === 'Pending' ? '#ef6c00' : '#666', fontWeight: "bold" }}>
                                                {appt.status}
                                            </span>
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

          {/* --- ARCHIVE & REQUESTS VIEW --- */}
          {activeView === "archive" && (
            <div className="card no-print" style={{ background: "white", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", height: "100%", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "20px", borderBottom: "1px solid #eee", display: "flex", gap: "10px" }}>
                    <button onClick={() => setArchiveTab("requests")} style={{ padding: "8px 20px", borderRadius: "20px", border: "none", background: archiveTab === "requests" ? "#2196F3" : "#f5f5f5", color: archiveTab === "requests" ? "white" : "#666", cursor: "pointer", fontWeight: "bold" }}>
                        {/* Only show General requests count here */}
                        Edit Requests {generalRequests.length > 0 && `(${generalRequests.length})`}
                    </button>
                    <button onClick={() => setArchiveTab("pets")} style={{ padding: "8px 20px", borderRadius: "20px", border: "none", background: archiveTab === "pets" ? "#2196F3" : "#f5f5f5", color: archiveTab === "pets" ? "white" : "#666", cursor: "pointer", fontWeight: "bold" }}>
                        {/* Count pending deletions + pending restores */}
                        Archived Pets {(stats.pendingDeletions + restoreRequests.length) > 0 && `(${stats.pendingDeletions + restoreRequests.length})`}
                    </button>
              </div>

              <div style={{ flex: 1, overflowY: "auto" }}>
                
                {/* 6. EDIT REQUESTS TABLE (NOW FILTERS OUT PET RESTORE REQUESTS) */}
                {archiveTab === "requests" && (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead style={{ position: "sticky", top: 0, background: "white" }}>
                            <tr style={{ textAlign: "left", color: "#666", borderBottom: "2px solid #eee" }}>
                                <th style={{ padding: "15px" }}>Type & Name</th>
                                <th style={{ padding: "15px" }}>Requested Changes</th>
                                <th style={{ padding: "15px" }}>Reason for Edit</th>
                                <th style={{ padding: "15px" }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {generalRequests.length === 0 ? (
                                <tr><td colSpan="4" style={{ textAlign: "center", padding: "20px", color: "#999" }}>No pending general requests.</td></tr>
                            ) : (
                                generalRequests.map((req) => (
                                    <tr key={req.id} style={{ borderBottom: "1px solid #f1f1f1" }}>
                                        <td style={{ padding: "15px", verticalAlign: "top" }}>
                                            <span style={{ 
                                                fontSize: "10px", padding: "2px 6px", borderRadius: "4px", fontWeight: "bold",
                                                background: req.type === 'inventory' ? '#e3f2fd' : '#f3e5f5',
                                                color: req.type === 'inventory' ? '#1976d2' : '#7b1fa2',
                                                display: "inline-block", marginBottom: "5px"
                                            }}>
                                                {req.type === 'inventory' ? 'INVENTORY' : 'PET'}
                                            </span>
                                            {/* Show ItemName if inventory, PetName if pet */}
                                            <div style={{ fontWeight: "bold" }}>{req.itemName || req.petName}</div>
                                        </td>
                                        <td style={{ padding: "15px", verticalAlign: "top" }}>
                                            <div style={{ background: "#f9f9f9", padding: "10px", borderRadius: "8px", fontSize: "13px" }}>
                                                {Object.entries(req.newData || {}).map(([key, val]) => {
                                                    const originalVal = req.originalData?.[key];
                                                    if (String(originalVal) !== String(val)) {
                                                        return (
                                                            <div key={key} style={{ marginBottom: "4px" }}>
                                                                <strong style={{ textTransform: "capitalize" }}>{key}:</strong>{" "}
                                                                <span style={{ color: "red", textDecoration: "line-through" }}>{originalVal}</span>
                                                                {" → "}
                                                                <span style={{ color: "green", fontWeight: "bold" }}>{val}</span>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                })}
                                            </div>
                                        </td>
                                        <td style={{ padding: "15px", verticalAlign: "top", fontStyle: "italic", color: "#555" }}>
                                            "{req.reason || "No reason provided"}"
                                        </td>
                                        <td style={{ padding: "15px", verticalAlign: "top" }}>
                                            <div style={{ display: "flex", gap: "10px" }}>
                                                <button onClick={() => handleApproveRequest(req)} style={{ background: "#e8f5e9", color: "#2e7d32", border: "none", padding: "8px 12px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>Approve</button>
                                                <button onClick={() => handleRejectRequest(req.id)} style={{ background: "#ffebee", color: "#d32f2f", border: "none", padding: "8px 12px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>Reject</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )}

                {/* ARCHIVED PETS TABLE (NOW INCLUDES REACTIVATION REQUESTS) */}
                {archiveTab === "pets" && (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead style={{ position: "sticky", top: 0, background: "white" }}>
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
                                <tr><td colSpan="5" style={{padding:"20px", textAlign:"center", color: "#666"}}>No archived pets.</td></tr>
                            ) : (
                                archivedPets.map(pet => {
                                    // Check if there's a restoration request for this pet
                                    const restoreReq = restoreRequests.find(r => r.petId === pet.id);
                                    
                                    return (
                                    <tr key={pet.id} style={{ borderBottom: "1px solid #f1f1f1", background: (pet.deletionStatus === "Pending" || restoreReq) ? "#fff8e1" : "transparent" }}>
                                        <td style={{ padding: "15px", fontWeight: "bold" }}>{pet.name}</td>
                                        <td style={{ padding: "15px" }}>{users.find(u => u.id === pet.ownerId)?.firstName}</td>
                                        
                                        {/* Status Column */}
                                        <td style={{ padding: "15px" }}>
                                            {restoreReq ? (
                                                <span style={{ color: "#2196F3", fontWeight: "bold" }}>Reactivation Requested</span>
                                            ) : pet.deletionStatus === "Pending" ? (
                                                <span style={{ color: "orange", fontWeight: "bold" }}>Deletion Pending</span>
                                            ) : (
                                                <span style={{ color: "#666" }}>Archived</span>
                                            )}
                                        </td>

                                        {/* Reason Column */}
                                        <td style={{ padding: "15px", fontStyle: "italic", color: "#555" }}>
                                            {restoreReq ? (
                                                <span><strong>Owner Reason:</strong> "{restoreReq.reason}"</span>
                                            ) : (
                                                pet.deletionReason || pet.archiveReason || "N/A"
                                            )}
                                        </td>

                                        {/* Actions Column */}
                                        <td style={{ padding: "15px" }}>
                                            {restoreReq ? (
                                                <div style={{ display: "flex", gap: "8px" }}>
                                                    <button onClick={() => handleApproveReactivation(restoreReq)} style={{ padding: "6px 12px", background: "#4CAF50", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}>Approve</button>
                                                    <button onClick={() => handleRejectReactivation(restoreReq.id)} style={{ padding: "6px 12px", background: "#f44336", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}>Reject</button>
                                                </div>
                                            ) : pet.deletionStatus === "Pending" ? (
                                            <div style={{ display: "flex", gap: "8px" }}>
                                                <button onClick={() => handleApproveDeletion(pet)} style={{ padding: "6px 12px", background: "#4CAF50", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}>Approve</button>
                                                <button onClick={() => handleRejectDeletion(pet.id)} style={{ padding: "6px 12px", background: "#f44336", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}>Reject</button>
                                            </div>
                                            ) : (
                                            <button onClick={() => handleRestorePet(pet.id)} style={{ padding: "6px 12px", background: "#2196F3", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}>Restore</button>
                                            )}
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
        </div>

        {/* --- 1. CUSTOM MODAL BOX (CENTERED) --- */}
        {modal.show && (
            <div className="modal-overlay no-print" style={{position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000}}>
                <div style={{ background: "white", padding: "25px", borderRadius: "12px", width: "400px", textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
                    <h3 style={{margin: "0 0 15px 0", color: "#333"}}>{modal.title}</h3>
                    <p style={{marginBottom: "20px", fontSize: "15px", color: "#555", whiteSpace: "pre-line"}}>{modal.message}</p>
                    
                    {/* Input Field for "input" type modal */}
                    {modal.type === "input" && (
                        <textarea 
                            value={modal.inputValue}
                            onChange={(e) => setModal({...modal, inputValue: e.target.value})}
                            placeholder="Type here..."
                            style={{width: "100%", height: "80px", padding: "10px", borderRadius: "6px", border: "1px solid #ddd", marginBottom: "20px", resize: "none", fontFamily: "inherit"}}
                        />
                    )}

                    <div style={{display: "flex", justifyContent: "center", gap: "15px"}}>
                        {(modal.type === "confirm" || modal.type === "input") ? (
                            <>
                                <button onClick={closeModal} style={{ padding: "10px 20px", background: "#e0e0e0", color: "#333", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>Cancel</button>
                                <button onClick={() => modal.onConfirm(modal.inputValue)} style={{ padding: "10px 20px", background: "#2196F3", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>Confirm</button>
                            </>
                        ) : (
                            <button onClick={closeModal} style={{ padding: "10px 20px", background: "#2196F3", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>OK</button>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* --- 2. BIGGER WIDE CHART MODAL --- */}
        {showChartModal && (
            <div className="modal-overlay no-print" style={{position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1100}}>
                <div style={{ background: "white", padding: "30px", borderRadius: "12px", width: "900px", maxWidth: "95%", height: "600px", display: "flex", flexDirection: "column" }}>
                     <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px"}}>
                        <h3 style={{margin: 0}}>Full Pet Breed Distribution</h3>
                        <button onClick={() => setShowChartModal(false)} style={{background: "transparent", border: "none", fontSize: "24px", cursor: "pointer", color: "#999"}}>✕</button>
                     </div>
                     <div style={{flex: 1, minHeight: 0}}>
                        <SimpleBarChart data={breedChartData} title="" hideLabels={false} />
                     </div>
                </div>
            </div>
        )}

        {/* PRINT MODAL */}
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
                                <span>{pet.name}</span>
                            </div>
                        ))}
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                        <button onClick={() => setShowPrintModal(false)} style={{ padding: "10px 20px", background: "#eee", border: "none", borderRadius: "6px", cursor: "pointer" }}>Cancel</button>
                        <button onClick={executePrint} disabled={selectedPetsForPrint.length === 0} style={{ padding: "10px 20px", background: "#2196F3", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", opacity: selectedPetsForPrint.length === 0 ? 0.5 : 1 }}>Print</button>
                    </div>
                </div>
            </div>
        )}

        {/* PRINT CONTENT */}
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
                    <thead><tr><th>Date</th><th>Pet</th><th>Owner</th><th>Service</th><th>Status</th></tr></thead>
                    <tbody>
                        {filteredAppointments.map(appt => (
                            <tr key={appt.id}>
                                <td>{appt.date}</td>
                                <td>{pets.find(p => p.id === appt.petId)?.name || "Unknown"}</td>
                                <td>{users.find(u => u.id === appt.userId)?.firstName}</td>
                                <td>{appt.reason}</td>
                                <td>{appt.status}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <table className="print-table">
                    <thead><tr><th>Pet Name</th><th>Species/Breed</th><th>Age/Gender</th><th>Owner Name</th><th>Contact</th></tr></thead>
                    <tbody>
                        {pets.filter(p => selectedPetsForPrint.includes(p.id)).map(pet => (
                            <tr key={pet.id}>
                                <td>{pet.name}</td>
                                <td>{pet.species} / {pet.breed}</td>
                                <td>{pet.age} / {pet.gender}</td>
                                <td>{users.find(u => u.id === pet.ownerId)?.firstName}</td>
                                <td>{users.find(u => u.id === pet.ownerId)?.email}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
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
              table { width: 100%; border-collapse: collapse; margin-top: 15px; }
              th, td { border: 1px solid #333; padding: 8px; text-align: left; font-size: 12px; }
              th { background-color: #f0f0f0; font-weight: bold; }
          }
          ::-webkit-scrollbar { width: 8px; }
          ::-webkit-scrollbar-track { background: #f1f1f1; }
          ::-webkit-scrollbar-thumb { background: #ccc; borderRadius: 4px; }
          ::-webkit-scrollbar-thumb:hover { background: #bbb; }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
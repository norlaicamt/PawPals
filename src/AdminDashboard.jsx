import { useEffect, useState, useMemo } from "react";
import { auth, db } from "./firebase";
import { signOut } from "firebase/auth";
import { collection, onSnapshot, doc, query, orderBy, updateDoc, deleteDoc, addDoc, getDoc } from "firebase/firestore"; 
import { useNavigate } from "react-router-dom";
import logoImg from "./assets/logo.png"; 
import emailjs from '@emailjs/browser';

// --- CONSTANTS FOR CONSULTATION (Copied from Staff) ---
const VISIT_REASONS = [
    "Routine Check-up", "Follow-up Check-up", "Vaccination", "Deworming", "Emergency"
];
const VACCINE_TYPES = [
    "5-in-1 (Dog)", "6-in-1 (Dog)", "8-in-1 (Dog)", "Anti-Rabies", 
    "Kennel Cough", "4-in-1 (Cat)", "Tricat (Cat)", "Deworming"
];
const SYMPTOM_OPTIONS = [
    "Vomiting", "Diarrhea", "Loss of Appetite", "Coughing", "Sneezing",
    "Limping / Lameness", "Skin Irritation / Itching", "Wound / Injury",
    "Eye Infection / Red Eyes", "Ear Infection / Ear Mites", "Fever", "Weight Loss", "Other"
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
    "Diabetes Mellitus", "Heart Disease", "Kidney Disease", "Liver Disease", "Other"
];
const INVENTORY_CATEGORIES = ["Vaccines", "Medicines / Drugs", "Medical Supplies"];

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
  const [medicalRecords, setMedicalRecords] = useState([]);
  // NEW: Inventory state for Consultation & Reports
  const [inventory, setInventory] = useState([]);
  const [inventoryLogs, setInventoryLogs] = useState([]);

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

  // --- CONSULTATION STATES (Active Appointment) ---
  const [showConsultModal, setShowConsultModal] = useState(false);
  const [selectedApptId, setSelectedApptId] = useState(null);
  const [consultData, setConsultData] = useState({
      date: new Date().toISOString().split('T')[0],
      reasons: [{ type: "Routine Check-up", vaccineType: "", nextSchedule: "" }], 
      symptoms: [],
      otherSymptom: "",
      diagnosis: "",
      otherDiagnosis: "",
      notes: "",
      prescriptionList: [],
      tempItemId: "",
      tempQty: 1,
      tempDispense: true,
      otherMedicine: "",
      followUp: ""
  });

  // --- REPORT STATES ---
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");

  // PRINT STATES
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedPetsForPrint, setSelectedPetsForPrint] = useState([]);
  // 'appointments', 'pets_list', 'history_single'
  const [printType, setPrintType] = useState("pets_list"); 

  // CHART MODAL STATE
  const [showChartModal, setShowChartModal] = useState(false);

  // --- CUSTOM BOX MODAL STATE ---
  const [modal, setModal] = useState({
      show: false, title: "", message: "", type: "confirm", inputValue: "", onConfirm: null 
  });
  
  const [isProcessing, setIsProcessing] = useState(false);

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

    const unsubReactivation = onSnapshot(collection(db, "reactivation_requests"), (snap) => {
        setReactivationRequests(snap.docs.map(d => ({ ...d.data(), id: d.id })));
    });

    const unsubRecords = onSnapshot(collection(db, "medical_records"), (snap) => {
        setMedicalRecords(snap.docs.map(d => ({ ...d.data(), id: d.id })));
    });

    // Fetch Inventory for Consultation/Reports
    const unsubInventory = onSnapshot(query(collection(db, "inventory")), (snap) => {
        setInventory(snap.docs.map(d => ({ ...d.data(), id: d.id })));
    });

    const unsubLogs = onSnapshot(query(collection(db, "inventoryLogs"), orderBy("timestamp", "desc")), (snap) => {
        setInventoryLogs(snap.docs.map(d => ({ ...d.data(), id: d.id })));
    });

    return () => { 
        unsubUsers(); unsubPets(); unsubAppts(); 
        unsubRequests(); unsubReactivation(); unsubRecords(); 
        unsubInventory(); unsubLogs();
    };
  }, []);

  // --- FILTER REQUESTS ---
  const restoreRequests = requests.filter(r => r.type === 'pet_restore');
  const generalRequests = requests.filter(r => r.type !== 'pet_restore');

  const stats = {
    totalOwners: users.filter(u => u.role === "owner" && !u.isDisabled).length,
    totalPets: pets.length,
    totalAppointments: appointments.length,
    pendingDeletions: archivedPets.filter(p => p.deletionStatus === "Pending").length,
    completedAppointments: appointments.filter(a => a.status === "Done").length
  };

  // --- DERIVED STATS FOR REPORTS ---
  const inventoryStats = useMemo(() => {
    const totalItems = inventory.length;
    const categoryCounts = {};
    INVENTORY_CATEGORIES.forEach(cat => categoryCounts[cat] = 0);
    inventory.forEach(item => {
        const cat = item.category || "Uncategorized";
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    const recentActivity = inventoryLogs
        .filter(log => log.change > 0)
        .slice(0, 5)
        .map(log => {
            const item = inventory.find(i => i.id === log.itemId);
            return { id: log.id, name: log.itemName, added: log.change, unit: item ? item.unit : "units" };
        });

    return { totalItems, categoryCounts, recentActivity };
  }, [inventory, inventoryLogs]);

  const appointmentStats = useMemo(() => {
    const totalAppts = appointments.length;
    const reasonCounts = {};
    VISIT_REASONS.forEach(r => reasonCounts[r] = 0);
    appointments.forEach(app => {
        const r = app.reason || "Other";
        reasonCounts[r] = (reasonCounts[r] || 0) + 1;
    });

    const today = new Date().toISOString().split('T')[0];
    const upcoming = appointments
        .filter(app => app.date >= today && app.status !== "Cancelled" && app.status !== "Declined")
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 5);

    return { totalAppts, reasonCounts, upcoming };
  }, [appointments]);

  const closeModal = () => {
      setModal({ ...modal, show: false, inputValue: "" });
      setIsProcessing(false);
  };
  
  const confirmAction = (title, message, action) => { 
      setModal({ show: true, title, message, type: "confirm", onConfirm: action, inputValue: "" }); 
  };
  
  const showAlert = (title, message) => { 
      setModal({ show: true, title, message, type: "alert", onConfirm: closeModal, inputValue: "" }); 
  };

  const inputAction = (title, message, action) => {
      setModal({ show: true, title, message, type: "input", onConfirm: action, inputValue: "" });
  };

  const handleLogout = () => { 
      confirmAction("Logout", "Are you sure you want to log out?", async () => { 
          await signOut(auth); 
          navigate("/"); 
          closeModal();
      });
  };

  // --- CONSULTATION HELPERS ---
  const addReason = () => {
    setConsultData(prev => ({
        ...prev,
        reasons: [...prev.reasons, { type: "Routine Check-up", vaccineType: "", nextSchedule: "" }]
    }));
  };

  const removeReason = (index) => {
    if (consultData.reasons.length <= 1) return; 
    const newReasons = [...consultData.reasons];
    newReasons.splice(index, 1);
    setConsultData({ ...consultData, reasons: newReasons });
  };

  const updateReasonLine = (index, field, value) => {
    const newReasons = [...consultData.reasons];
    newReasons[index][field] = value;
    setConsultData({ ...consultData, reasons: newReasons });
  };

  const handleSymptomChange = (sym) => {
    setConsultData(prev => {
        const isSelected = prev.symptoms.includes(sym);
        let newSymptoms;
        if (isSelected) { newSymptoms = prev.symptoms.filter(s => s !== sym); } 
        else { newSymptoms = [...prev.symptoms, sym]; }
        return {
            ...prev,
            symptoms: newSymptoms,
            otherSymptom: !isSelected && sym === "Other" ? prev.otherSymptom : (sym === "Other" ? "" : prev.otherSymptom)
        };
    });
  };

  const addItemToPrescription = () => {
    if (!consultData.tempItemId) return showAlert("Error", "Select an item first.");
    const item = inventory.find(i => i.id === consultData.tempItemId);
    const isOther = consultData.tempItemId === "Other";
    const newItem = {
        id: consultData.tempItemId,
        name: isOther ? consultData.otherMedicine : item.name,
        qty: consultData.tempQty,
        dispense: isOther ? false : consultData.tempDispense,
        unit: item?.unit || "unit(s)"
    };
    setConsultData(prev => ({
        ...prev,
        prescriptionList: [...prev.prescriptionList, newItem],
        tempItemId: "",
        tempQty: 1,
        otherMedicine: ""
    }));
  };

  const openConsultModal = (apptId) => {
    setSelectedApptId(apptId);
    const appt = appointments.find(a => a.id === apptId);
    const existingSymptoms = appt.symptoms ? appt.symptoms.split(", ") : [];
    const initialReason = appt.reason ? 
        [{ type: appt.reason, vaccineType: "", nextSchedule: "" }] : 
        [{ type: "Routine Check-up", vaccineType: "", nextSchedule: "" }];

    setConsultData({
        date: new Date().toISOString().split('T')[0],
        reasons: initialReason,
        symptoms: existingSymptoms,
        diagnosis: "",
        otherSymptom: "",
        otherDiagnosis: "",
        medicine: "",
        notes: "",
        followUp: "",
        prescriptionList: [], 
        tempItemId: "",
        tempQty: 1,
        tempDispense: true,
        otherMedicine: ""
    });
    setShowConsultModal(true);
  };

  const handleFinishConsultation = async (e) => {
    e.preventDefault();
    setIsProcessing(true);

    // Validations
    const hasCheckup = consultData.reasons.some(r => r.type.includes("Check-up") || r.type === "Emergency");
    const hasVaccine = consultData.reasons.some(r => r.type === "Vaccination" || r.type === "Deworming");

    if (hasCheckup && consultData.prescriptionList.length === 0) {
        setIsProcessing(false);
        return showAlert("Error", "Please add at least one treatment/medicine for this check-up.");
    }
    if (hasCheckup && !consultData.diagnosis) {
        setIsProcessing(false);
        return showAlert("Error", "Please select a diagnosis for the check-up.");
    }
    if (hasVaccine) {
       const incompleteVaccine = consultData.reasons.find(r => (r.type === "Vaccination" || r.type === "Deworming") && !r.vaccineType);
       if (incompleteVaccine) {
           setIsProcessing(false);
           return showAlert("Error", "Please specify the Vaccine/Deworming Type.");
       }
    }

    try {
        const apptDoc = appointments.find(a => a.id === selectedApptId);

        // 1. Deduct Inventory
        for (const item of consultData.prescriptionList) {
            if (item.id !== "Other" && item.dispense) {
                const invItem = inventory.find(i => i.id === item.id);
                if (invItem) {
                    await updateDoc(doc(db, "inventory", item.id), {
                        quantity: Number(invItem.quantity) - item.qty,
                        lastUpdated: new Date()
                    });
                    await addDoc(collection(db, "inventoryLogs"), {
                        itemId: item.id, itemName: item.name, change: -item.qty, reason: `Dispensed: Appt ${selectedApptId}`, timestamp: new Date()
                    });
                }
            }
        }

        // 2. Create Medical Record
        const treatmentSummary = consultData.prescriptionList.map(p => `${p.name} (x${p.qty})`).join(", ");
        const reasonSummary = consultData.reasons.map(r => r.type).join(", ");
        const diagnosisSummary = hasCheckup ? (consultData.diagnosis === "Other" ? consultData.otherDiagnosis : consultData.diagnosis) : "N/A (Vaccination/Routine)";

        await addDoc(collection(db, "medical_records"), {
            apptId: selectedApptId,
            petId: apptDoc.petId,
            petName: apptDoc.petName,
            ownerId: apptDoc.ownerId,
            date: consultData.date,
            reason: reasonSummary,
            detailedReasons: consultData.reasons,
            diagnosis: diagnosisSummary,
            treatment: treatmentSummary,
            prescriptionDetails: consultData.prescriptionList,
            notes: consultData.notes,
            followUpDate: consultData.followUp,
            staffId: auth.currentUser.uid, // Admin is doing this
            createdAt: new Date()
        });

        // 3. Update Appointment
        await updateDoc(doc(db, "appointments", selectedApptId), {
            status: "Done", // Maps to 'Completed' in UI
            isCompleted: true,
            diagnosis: diagnosisSummary,
            reason: reasonSummary,
            completedAt: new Date()
        });

        setShowConsultModal(false);
        showAlert("Success", "Consultation Completed Successfully!");
    } catch (err) {
        console.error(err);
        showAlert("Error", "Failed to save consultation.");
    } finally {
        setIsProcessing(false);
    }
  };

  // --- EXISTING ACTIONS ---
  const handleToggleUserStatus = (user) => {
    const isDisabling = !user.isDisabled; 
    
    if (!isDisabling) {
        // --- REACTIVATING / ENABLING ---
        confirmAction("Enable Account", "Enable this account and notify owner?", async () => {
            try {
                // 1. Update user status in Firestore
                await updateDoc(doc(db, "users", user.id), { 
                    isDisabled: false, 
                    disableReason: null 
                });

                // --- ADD THIS BLOCK TO REMOVE THE WARNING ---
                // 2. Find and delete the reactivation request document
                const requestToDelete = reactivationRequests.find(req => req.email === user.email);
                if (requestToDelete) {
                    await deleteDoc(doc(db, "reactivation_requests", requestToDelete.id));
                }
                // --------------------------------------------

                // 3. Prepare Email Parameters
                const templateParams = {
                    to_email: user.email,
                    to_name: user.firstName,
                    login_url: "https://pawpals-bfacb.web.app" 
                };

                // 4. Send Email via EmailJS
                await emailjs.send(
                    'service_2glnwym', 
                    'template_zcrc0nj', 
                    templateParams, 
                    'ORmxWraQvhedoUHOe'
                );

                closeModal();
                showAlert("Success", "Account Reactivated and Email Sent!");
            } catch (err) {
                console.error("Failed to reactivate:", err);
                showAlert("Error", "Action failed. Please check your connection.");
            }
        });
    } else {
        inputAction("Disable Account", "Enter reason for disabling:", async (reason) => {
            if(!reason) return;
            try {
                await updateDoc(doc(db, "users", user.id), { isDisabled: true, disableReason: reason });
                closeModal();
                showAlert("Success", "Account Disabled.");
            } catch (err) {
                console.error(err);
                showAlert("Error", "Could not disable account.");
            }
        });
    }
};

  const handleManualArchive = (id) => { 
      inputAction("Archive Pet", "Please enter a reason for archiving this pet.", async (reason) => {
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

  const handleApproveReactivation = (req) => {
    confirmAction("Approve Reactivation", "Approve request and restore this pet?", async () => {
        try {
            await updateDoc(doc(db, "pets", req.petId), { 
                isArchived: false, 
                archiveReason: null,
                deletionStatus: null, 
                deletionReason: null, 
                reactivationAlert: true 
            });
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
    confirmAction("Reject Reactivation", "Reject this reactivation request?", async () => {
        await deleteDoc(doc(db, "edit_requests", reqId));
        closeModal();
        showAlert("Rejected", "Request removed. Pet remains archived.");
    });
  };

  const handleApproveRequest = async (req) => {
    confirmAction("Approve Update", "Approve these changes?", async () => {
        try {
            const collectionName = req.type === 'inventory' ? 'inventory' : 'pets';
            const isAddOperation = req.action === 'add' || (!req.itemId && !req.petId);

            if (isAddOperation) {
                await addDoc(collection(db, collectionName), req.newData);
            } else {
                const itemRef = doc(db, collectionName, req.itemId || req.petId);
                const itemSnap = await getDoc(itemRef);
                if (!itemSnap.exists()) {
                    closeModal();
                    showAlert("Error", "Item/Pet no longer exists.");
                    return;
                }
                await updateDoc(itemRef, req.newData);
            }
            await deleteDoc(doc(db, "edit_requests", req.id));
            closeModal();
            showAlert("Success", "Update processed successfully.");
        } catch (error) {
            console.error(error);
            closeModal();
            showAlert("Error", "Failed to process request: " + error.message);
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

  // --- PRINT FUNCTIONS ---
  const togglePetSelection = (petId) => {
      setSelectedPetsForPrint(prev => prev.includes(petId) ? prev.filter(id => id !== petId) : [...prev, petId]);
  };

  const handleSelectAllForPrint = () => {
      const currentPets = pets.sort((a, b) => a.name.localeCompare(b.name));
      setSelectedPetsForPrint(selectedPetsForPrint.length === currentPets.length ? [] : currentPets.map(p => p.id));
  };

  const openPrintModal = () => {
      setPrintType("pets_list");
      setSelectedPetsForPrint([]); 
      setShowPrintModal(true);
  };
  
  const handlePrintAppointments = () => {
      setPrintType("appointments");
      setTimeout(() => window.print(), 300);
  };

  const handlePrintSinglePetHistory = (pet) => {
      setViewingRecord(pet);
      setPrintType("history_single");
      setTimeout(() => window.print(), 500);
  };

  const executePrintList = () => {
      setShowPrintModal(false);
      setTimeout(() => window.print(), 500);
  };

  const printSummaryReport = () => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0'; iframe.style.bottom = '0';
    iframe.style.width = '0'; iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const totalItems = inventory.length;
    const lowStockCount = inventory.filter(i => i.quantity <= i.threshold).length;
    const today = new Date();
    const warningDate = new Date(); warningDate.setDate(today.getDate() + 60);

    const expiringItems = inventory.filter(item => {
        if (!item.expiryDate) return false;
        const exp = new Date(item.expiryDate);
        return exp <= warningDate;
    }).sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate)).slice(0, 5);

    const recentStockLogs = inventoryLogs
        .filter(log => log.change > 0)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 5)
        .map(log => {
            const item = inventory.find(i => i.id === log.itemId);
            return { ...log, unit: item ? item.unit : "units" };
        });

    const completedAppts = appointments.filter(a => a.status === 'Done' || a.isCompleted).sort((a, b) => new Date(b.date) - new Date(a.date));
    const upcomingAppts = appointments
        .filter(app => app.date >= today.toISOString().split('T')[0] && app.status !== "Cancelled")
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 5);

    const htmlContent = `
    <html>
        <head>
            <style>
                body { font-family: 'Segoe UI', sans-serif; padding: 40px; color: #333; }
                h1 { color: #2c3e50; text-align: center; margin-bottom: 5px; }
                .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
                .dashboard-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px; }
                .card { border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; background: #fff; }
                .card h3 { margin-top: 0; color: #1976D2; border-bottom: 1px solid #f0f0f0; padding-bottom: 10px; font-size: 16px; }
                ul { padding-left: 20px; margin: 0; }
                li { margin-bottom: 6px; font-size: 13px; color: #555; }
                .badge-red { color: #d32f2f; font-weight: bold; }
                .badge-green { color: #2e7d32; font-weight: bold; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
                th { background: #f8f9fa; padding: 12px; text-align: left; border-bottom: 2px solid #ddd; }
                td { padding: 10px; border-bottom: 1px solid #eee; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>PawPals Clinic Report</h1>
                <div style="color:#888;">Generated: ${new Date().toLocaleString()}</div>
            </div>

            <div class="dashboard-grid">
                <div class="card">
                    <h3>📦 Inventory Health</h3>
                    <div>Total: <b>${totalItems}</b> | Low: <b class="badge-red">${lowStockCount}</b></div>
                    <p style="font-size:12px; margin-bottom:5px;"><b>Expiring Soon:</b></p>
                    <ul>
                        ${expiringItems.length > 0 ? expiringItems.map(i => `<li>${i.name} (${i.expiryDate})</li>`).join('') : '<li>None</li>'}
                    </ul>
                </div>
                <div class="card">
                    <h3>📥 Recent Stock Additions</h3>
                    <ul>
                        ${recentStockLogs.length > 0 ? recentStockLogs.map(log => `<li>${log.itemName}: <span class="badge-green">+${log.change} ${log.unit}</span></li>`).join('') : '<li>No recent changes</li>'}
                    </ul>
                </div>
                <div class="card">
                    <h3>🔜 Upcoming Schedule</h3>
                    <ul>
                        ${upcomingAppts.length > 0 ? upcomingAppts.map(app => `<li><b>${app.date}</b>: ${app.petName} (${app.reason})</li>`).join('') : '<li>No upcoming appointments</li>'}
                    </ul>
                </div>
            </div>
            <h3>Appointment History (Completed)</h3>
            <table>
                <thead><tr><th>Date</th><th>Pet Name</th><th>Reason</th></tr></thead>
                <tbody>
                    ${completedAppts.length > 0 ? completedAppts.map(app => `<tr><td>${app.date}</td><td>${app.petName}</td><td>${app.reason}</td></tr>`).join('') : '<tr><td colspan="3">No completed appointments</td></tr>'}
                </tbody>
            </table>
            <br/>
            <h3>Detailed Inventory</h3>
            <table>
                <thead><tr><th>Item</th><th>Category</th><th>Qty</th><th>Status</th></tr></thead>
                <tbody>
                    ${inventory.map(item => `<tr><td>${item.name}</td><td>${item.category}</td><td>${item.quantity} ${item.unit}</td><td>${item.quantity <= item.threshold ? 'Low Stock' : 'Good'}</td></tr>`).join('')}
                </tbody>
            </table>
        </body>
    </html>
    `;
    const doc = iframe.contentWindow.document;
    doc.open(); doc.write(htmlContent); doc.close();
    setTimeout(() => { iframe.contentWindow.focus(); iframe.contentWindow.print(); document.body.removeChild(iframe); }, 500);
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
      // Logic for filtered view: "Done" in DB matches "Completed" in filter dropdown
      const statusMatch = recordStatus === "All" 
        ? true 
        : recordStatus === "Completed" ? (a.status === "Done") 
        : (a.status === recordStatus);

      return statusMatch && (recordServiceFilter === "All" || a.reason === recordServiceFilter);
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
        <div className="no-print" style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "10px", marginBottom: "20px", flexShrink: 0 }}>
          <button style={getTabStyle("overview")} onClick={() => setActiveView("overview")}>Overview</button>
          <button style={getTabStyle("accounts")} onClick={() => setActiveView("accounts")}>Accounts</button>
          <button style={getTabStyle("pets")} onClick={() => setActiveView("pets")}>Pets List</button>
          <button style={getTabStyle("records")} onClick={() => setActiveView("records")}>Records</button>
          <button style={getTabStyle("active_appointment")} onClick={() => setActiveView("active_appointment")}>Active Appt</button>
          <button style={getTabStyle("clinic_reports")} onClick={() => setActiveView("clinic_reports")}>Clinic Reports</button>
          
          <button style={getTabStyle("archive")} onClick={() => setActiveView("archive")}>
            Archive
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
                        <button onClick={() => setShowChartModal(true)} style={{ position: "absolute", bottom: "15px", right: "15px", padding: "8px 15px", background: "#2196F3", color: "white", border: "none", borderRadius: "20px", cursor: "pointer", fontWeight: "bold", fontSize: "12px", boxShadow: "0 2px 5px rgba(0,0,0,0.2)" }}>VIEW FULL CHART</button>
                    </div>
                    <div className="card" style={{ background: "white", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", padding: "20px" }}>
                        <h4 style={{ margin: "0 0 15px 0", borderBottom: "1px solid #eee", paddingBottom: "10px", color: "#333" }}>System Quick Stats</h4>
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "15px", background: "#f9f9f9", borderRadius: "8px", border: "1px solid #eee" }}>
                                <span>Pending Edit Requests</span>
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
                  <button onClick={openPrintModal} style={{ background: "#607D8B", color: "white", border: "none", padding: "8px 15px", borderRadius: "6px", cursor: "pointer", marginLeft: "10px", fontSize: "12px", display: "flex", alignItems: "center", gap: "5px" }}>
                    🖨️ Print List
                  </button>
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
                        <th style={{ padding: "15px" }}>Birthdate / Age</th> {/* <--- ADD HEADER */}
                        <th style={{ padding: "15px" }}>Owner</th>
                        <th style={{ padding: "15px" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPets.map(pet => (
                      <tr key={pet.id} style={{ borderBottom: "1px solid #f1f1f1" }}>
                        <td style={{ padding: "15px", fontWeight: "bold" }}>{pet.name}</td>
                        <td style={{ padding: "15px" }}>{pet.species} ({pet.breed})</td>
                        <td style={{ padding: "15px" }}>
                         <div>{pet.birthdate || "N/A"}</div><div style={{ fontSize: "12px", color: "#888" }}>{pet.age} {pet.ageUnit}</div></td>
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
                
                {/* RECORDS HEADER */}
                <div style={{ padding: "20px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: "10px" }}>
                        <button onClick={() => setRecordTab("pets")} style={{ padding: "10px 20px", borderRadius: "20px", border: "none", background: recordTab === "pets" ? "#2196F3" : "#f5f5f5", color: recordTab === "pets" ? "white" : "#666", cursor: "pointer", fontWeight: "bold" }}>Pet History</button>
                        <button onClick={() => setRecordTab("appointments")} style={{ padding: "10px 20px", borderRadius: "20px", border: "none", background: recordTab === "appointments" ? "#2196F3" : "#f5f5f5", color: recordTab === "appointments" ? "white" : "#666", cursor: "pointer", fontWeight: "bold" }}>Appointments</button>
                    </div>
                    {recordTab === "pets" && (
                        <input type="text" placeholder="Search pet for records..." value={recordPetSearch} onChange={(e) => setRecordPetSearch(e.target.value)} style={{ width: "250px", padding: "10px", border: "1px solid #ddd", borderRadius: "8px" }} />
                    )}
                </div>

                {/* RECORDS CONTENT BODY */}
                {recordTab === "pets" ? (
                    <div style={{ display: "flex", height: "100%" }}>
                        {/* LEFT: PET LIST */}
                        <div style={{ width: "300px", borderRight: "1px solid #eee", overflowY: "auto", background: "#fcfcfc" }}>
                            {sortedPetsForRecords.map(pet => (
                                <div key={pet.id} onClick={() => setViewingRecord(pet)} style={{ padding: "15px", borderBottom: "1px solid #eee", cursor: "pointer", background: viewingRecord?.id === pet.id ? "#e3f2fd" : "transparent" }}>
                                    <div style={{ fontWeight: "bold", color: "#333" }}>{pet.name}</div>
                                    <div style={{ fontSize: "12px", color: "#666" }}>{pet.species} • {pet.breed}</div>
                                </div>
                            ))}
                        </div>
                        
                        {/* RIGHT: PET DETAILS */}
                        <div style={{ flex: 1, padding: "20px", overflowY: "auto" }}>
                            {viewingRecord ? (
                                <div style={{ background: "white", padding: "25px", borderRadius: "12px", border: "1px solid #eee" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px", borderBottom: "1px solid #eee", paddingBottom: "15px" }}>
                                        <div>
                                            <h2 style={{ margin: "0 0 5px 0", color: "#333" }}>{viewingRecord.name}</h2>
                                            <span style={{ fontSize: "14px", color: "#666", background: "#f5f5f5", padding: "4px 10px", borderRadius: "15px" }}>
                                             {viewingRecord.species} • {viewingRecord.breed} • {viewingRecord.gender} • Born: {viewingRecord.birthdate || "N/A"}
                                            </span>
                                        </div>
                                        <button onClick={() => handlePrintSinglePetHistory(viewingRecord)} style={{ height: "fit-content", background: "#607D8B", color: "white", border: "none", padding: "8px 15px", borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
                                            <span>🖨️</span> Print History
                                        </button>
                                    </div>
                                    
                                    <div style={{ overflowX: "auto" }}>
                                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                                            <thead>
                                                <tr style={{ background: "#f9f9f9", color: "#555", textAlign: "left" }}>
                                                    <th style={{ padding: "12px 10px", borderBottom: "2px solid #eee", width: "120px" }}>Date</th>
                                                    <th style={{ padding: "12px 10px", borderBottom: "2px solid #eee", width: "180px" }}>Diagnosis</th>
                                                    <th style={{ padding: "12px 10px", borderBottom: "2px solid #eee" }}>Prescription / Treatment</th>
                                                    <th style={{ padding: "12px 10px", borderBottom: "2px solid #eee" }}>Notes</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {medicalRecords
                                                    .filter(r => r.petId === viewingRecord.id)
                                                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                                                    .map(record => (
                                                    <tr key={record.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                                                        <td style={{ padding: "15px 10px", verticalAlign: "top", color: "#333", fontWeight: "500" }}>{new Date(record.date).toLocaleDateString()}</td>
                                                        <td style={{ padding: "15px 10px", verticalAlign: "top" }}><span style={{ background: "#e3f2fd", color: "#1565c0", padding: "3px 8px", borderRadius: "4px", fontSize: "13px", display: "inline-block" }}>{record.diagnosis || "Medical Visit"}</span></td>
                                                        <td style={{ padding: "15px 10px", verticalAlign: "top" }}>
                                                            {record.prescriptionDetails && record.prescriptionDetails.length > 0 ? (
                                                                <ul style={{ margin: 0, paddingLeft: "15px", listStyleType: "circle", color: "#444" }}>
                                                                    {record.prescriptionDetails.map((p, idx) => (
                                                                        <li key={idx} style={{ marginBottom: "4px" }}>
                                                                            <span style={{ fontWeight: "600" }}>{p.name}</span> <span style={{ color: "#777", fontSize: "13px" }}>— {p.qty} {p.unit}</span>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            ) : (record.prescriptionList && record.prescriptionList.length > 0) ? (
                                                                <ul style={{ margin: 0, paddingLeft: "15px", listStyleType: "circle", color: "#444" }}>
                                                                    {record.prescriptionList.map((p, idx) => (<li key={idx}>{p.name} — {p.qty} {p.unit}</li>))}
                                                                </ul>
                                                            ) : (<span style={{ color: "#888", fontStyle: "italic" }}>{record.treatment || record.prescription || "No prescription recorded."}</span>)}
                                                        </td>
                                                        <td style={{ padding: "15px 10px", verticalAlign: "top", color: "#666", fontSize: "13px", fontStyle: "italic" }}>{record.notes || "-"}</td>
                                                    </tr>
                                                ))}
                                                {medicalRecords.filter(r => r.petId === viewingRecord.id).length === 0 && (
                                                    <tr><td colSpan="4" style={{ textAlign: "center", padding: "30px", color: "#999" }}>No medical history found for this pet.</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (<div style={{ textAlign: "center", color: "#aaa", marginTop: "50px" }}>Select a pet to view history</div>)}
                        </div>
                    </div>
                ) : (
                    /* APPOINTMENTS TAB CONTENT */
                    <div style={{ background: "white", borderRadius: "12px", border: "1px solid #eee", margin: "20px" }}>
                        <div style={{ padding: "15px", borderBottom: "1px solid #eee", display: "flex", gap: "15px", background: "#f9f9f9", alignItems: "center" }}>
                            <span style={{ fontSize: "14px", fontWeight: "bold", color: "#555" }}>Filter By:</span>
                            <select value={recordStatus} onChange={(e) => setRecordStatus(e.target.value)} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}>
                                <option value="All">All Statuses</option>
                                <option value="Pending">Pending</option>
                                <option value="Completed">Completed</option>
                                <option value="Cancelled">Cancelled</option>
                            </select>
                            <select value={recordServiceFilter} onChange={(e) => setRecordServiceFilter(e.target.value)} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}><option value="All">All Services</option>{uniqueServices.map(service => (<option key={service} value={service}>{service}</option>))}</select>
                            <button onClick={handlePrintAppointments} style={{ marginLeft: "auto", background: "#607D8B", color: "white", padding: "8px 15px", borderRadius: "6px", border: "none", cursor: "pointer" }}>Print List</button>
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead><tr style={{ background: "#f5f5f5", textAlign: "left" }}><th style={{ padding: "12px" }}>Date</th><th style={{ padding: "12px" }}>Owner</th><th style={{ padding: "12px" }}>Pet</th><th style={{ padding: "12px" }}>Service</th><th style={{ padding: "12px" }}>Status</th></tr></thead>
                            <tbody>
                                {filteredAppointments.map(appt => (
                                    <tr key={appt.id} style={{ borderBottom: "1px solid #eee" }}>
                                        <td style={{ padding: "12px" }}>{appt.date}</td><td style={{ padding: "12px" }}>{users.find(u => u.id === appt.userId)?.firstName}</td><td style={{ padding: "12px" }}>{pets.find(p => p.id === appt.petId)?.name || "Unknown"}</td><td style={{ padding: "12px" }}>{appt.reason}</td><td style={{ padding: "12px" }}><span style={{ padding: "4px 8px", borderRadius: "4px", fontSize: "12px", background: appt.status === 'Done' ? '#e8f5e9' : appt.status === 'Pending' ? '#fff3e0' : '#eee', color: appt.status === 'Done' ? '#2e7d32' : appt.status === 'Pending' ? '#ef6c00' : '#666', fontWeight: "bold" }}>{appt.status === 'Done' ? 'Completed' : appt.status}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
          )}

          {/* --- NEW: ACTIVE APPOINTMENT (CONSULTATION) VIEW --- */}
          {activeView === "active_appointment" && (
            <div className="card no-print" style={{ background: "white", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", height: "100%", display: "flex", flexDirection: "column", padding: "20px" }}>
                <h3 style={{ borderBottom: "1px solid #eee", paddingBottom: "15px", marginBottom: "15px" }}>Active Appointments (Ready for Consultation)</h3>
                <div style={{ flex: 1, overflowY: "auto" }}>
                    {appointments.filter(a => a.status === 'Approved' && !a.isCompleted).length === 0 && <p style={{ color: "#888", textAlign: "center", marginTop: "20px" }}>No active appointments waiting for consultation.</p>}
                    {appointments.filter(a => a.status === 'Approved' && !a.isCompleted).map(appt => (
                        <div key={appt.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f9f9f9", padding: "15px", borderRadius: "8px", border: "1px solid #eee", marginBottom: "10px" }}>
                            <div>
                                <div style={{ fontWeight: "bold", fontSize: "16px" }}>{appt.petName} <span style={{fontSize:"12px", color:"#666"}}>({appt.reason})</span></div>
                                <div style={{ fontSize: "12px", color: "#555" }}>Owner: {users.find(u => u.id === appt.ownerId)?.firstName || "Unknown"}</div>
                                <div style={{ fontSize: "12px", color: "#555" }}>Time: {appt.time} | Date: {appt.date}</div>
                            </div>
                            <button onClick={() => openConsultModal(appt.id)} style={{ background: "#2196F3", color: "white", border: "none", padding: "8px 15px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>Start Consultation</button>
                        </div>
                    ))}
                </div>
            </div>
          )}

          {/* --- NEW: CLINIC REPORTS VIEW --- */}
          {activeView === "clinic_reports" && (
            <div className="card no-print" style={{ background: "white", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", height: "100%", overflowY: "auto", padding: "30px" }}>
                 <div style={{ maxWidth: "800px", margin: "0 auto" }}>
                    <h2 style={{ textAlign: "center", color: "#333", marginBottom: "30px" }}>Clinic Performance Reports</h2>

                    <div style={{ background: "#f5f5f5", padding: "20px", borderRadius: "12px", display: "flex", gap: "15px", alignItems: "center", justifyContent: "center", marginBottom: "30px", border: "1px solid #ddd" }}>
                        <label><strong>From:</strong> <input type="date" value={reportStartDate} onChange={(e) => setReportStartDate(e.target.value)} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }} /></label>
                        <label><strong>To:</strong> <input type="date" value={reportEndDate} onChange={(e) => setReportEndDate(e.target.value)} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }} /></label>
                        {(reportStartDate && reportEndDate) && <button onClick={printSummaryReport} style={{ marginLeft: "15px", background: "#607D8B", color: "white", border: "none", padding: "8px 15px", borderRadius: "6px", cursor: "pointer" }}>🖨️ Print Summary</button>}
                    </div>

                    {(reportStartDate && reportEndDate) ? (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                            {/* Inventory Stats Block */}
                            <div style={{ background: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)", marginBottom: "20px" }}>
                                <h4 style={{ marginTop: 0, color: "#444", borderBottom: "1px solid #eee", paddingBottom: "10px" }}>Inventory Overview</h4>
                                <div style={{ display: "flex", gap: "40px", flexWrap: "wrap", marginTop: "15px" }}>
                                    <div style={{ flex: "1", minWidth: "150px", borderRight: "1px solid #eee" }}>
                                        <div style={{ fontSize: "14px", color: "#888" }}>Total Unique Items</div>
                                        <div style={{ fontSize: "32px", fontWeight: "bold", color: "#2196F3" }}>{inventoryStats.totalItems}</div>
                                    </div>
                                    <div style={{ flex: "2", minWidth: "250px" }}>
                                        <div style={{ fontSize: "14px", color: "#888", marginBottom: "10px" }}>Recently Added Stock</div>
                                        {inventoryStats.recentActivity.length > 0 ? (
                                            <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px", color: "#555" }}>
                                                {inventoryStats.recentActivity.map(log => (<li key={log.id} style={{ marginBottom: "5px" }}><strong>{log.name}</strong><span style={{ color: "#2e7d32", fontWeight: "bold", marginLeft: "6px" }}>+{log.added} {log.unit}</span></li>))}
                                            </ul>
                                        ) : <div style={{ fontSize: "13px", color: "#aaa", fontStyle: "italic" }}>No recent additions</div>}
                                    </div>
                                </div>
                            </div>

                            {/* Appointments Stats Block */}
                            <div style={{ background: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)", marginBottom: "20px" }}>
                                <h4 style={{ marginTop: 0, color: "#444", borderBottom: "1px solid #eee", paddingBottom: "10px" }}>📅 Appointment Overview</h4>
                                <div style={{ display: "flex", gap: "40px", flexWrap: "wrap", marginTop: "15px" }}>
                                    <div style={{ flex: "1", minWidth: "150px", borderRight: "1px solid #eee" }}>
                                        <div style={{ fontSize: "14px", color: "#888" }}>Total Appointments</div>
                                        <div style={{ fontSize: "32px", fontWeight: "bold", color: "#4CAF50" }}>{appointmentStats.totalAppts}</div>
                                    </div>
                                    <div style={{ flex: "2", minWidth: "250px" }}>
                                        <div style={{ fontSize: "14px", color: "#888", marginBottom: "10px" }}>Upcoming Appointments</div>
                                        {appointmentStats.upcoming.length > 0 ? (
                                            <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px", color: "#555" }}>
                                                {appointmentStats.upcoming.map(app => (<li key={app.id} style={{ marginBottom: "5px" }}><strong>{app.date}</strong> - {app.petName} <span style={{ color: "#999" }}>({app.reason})</span></li>))}
                                            </ul>
                                        ) : <div style={{ fontSize: "13px", color: "#aaa", fontStyle: "italic" }}>No upcoming appointments</div>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ textAlign: "center", color: "#888", padding: "50px", border: "2px dashed #ddd", borderRadius: "12px" }}>Please select a date range to generate the report.</div>
                    )}
                </div>
            </div>
          )}

          {/* --- ARCHIVE & REQUESTS VIEW --- */}
          {activeView === "archive" && (
            <div className="card no-print" style={{ background: "white", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", height: "100%", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "20px", borderBottom: "1px solid #eee", display: "flex", gap: "10px" }}>
                    <button onClick={() => setArchiveTab("requests")} style={{ padding: "8px 20px", borderRadius: "20px", border: "none", background: archiveTab === "requests" ? "#2196F3" : "#f5f5f5", color: archiveTab === "requests" ? "white" : "#666", cursor: "pointer", fontWeight: "bold" }}>Edit Requests {generalRequests.length > 0 && `(${generalRequests.length})`}</button>
                    <button onClick={() => setArchiveTab("pets")} style={{ padding: "8px 20px", borderRadius: "20px", border: "none", background: archiveTab === "pets" ? "#2196F3" : "#f5f5f5", color: archiveTab === "pets" ? "white" : "#666", cursor: "pointer", fontWeight: "bold" }}>Archived Pets {(stats.pendingDeletions + restoreRequests.length) > 0 && `(${stats.pendingDeletions + restoreRequests.length})`}</button>
              </div>

              <div style={{ flex: 1, overflowY: "auto" }}>
                {archiveTab === "requests" && (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead style={{ position: "sticky", top: 0, background: "white" }}><tr style={{ textAlign: "left", color: "#666", borderBottom: "2px solid #eee" }}><th style={{ padding: "15px" }}>Type & Name</th><th style={{ padding: "15px" }}>Requested Changes</th><th style={{ padding: "15px" }}>Reason</th><th style={{ padding: "15px" }}>Actions</th></tr></thead>
                        <tbody>
                            {generalRequests.map((req) => (
                                <tr key={req.id} style={{ borderBottom: "1px solid #f1f1f1" }}>
                                    <td style={{ padding: "15px", verticalAlign: "top" }}><div style={{ fontWeight: "bold" }}>{req.itemName || req.petName}</div></td>
                                    <td style={{ padding: "15px", verticalAlign: "top" }}><div style={{ background: "#f9f9f9", padding: "10px", borderRadius: "8px", fontSize: "13px" }}>{Object.entries(req.newData || {}).map(([key, val]) => (<div key={key}>{key}: {val}</div>))}</div></td>
                                    <td style={{ padding: "15px", verticalAlign: "top", fontStyle: "italic", color: "#555" }}>"{req.reason || "No reason"}"</td>
                                    <td style={{ padding: "15px", verticalAlign: "top" }}><div style={{ display: "flex", gap: "10px" }}><button onClick={() => handleApproveRequest(req)} style={{ background: "#e8f5e9", color: "#2e7d32", border: "none", padding: "8px 12px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>Approve</button><button onClick={() => handleRejectRequest(req.id)} style={{ background: "#ffebee", color: "#d32f2f", border: "none", padding: "8px 12px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>Reject</button></div></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                {archiveTab === "pets" && (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead style={{ position: "sticky", top: 0, background: "white" }}><tr style={{ textAlign: "left", color: "#666" }}><th style={{ padding: "15px" }}>Pet Name</th><th style={{ padding: "15px" }}>Owner</th><th style={{ padding: "15px" }}>Status</th><th style={{ padding: "15px" }}>Actions</th></tr></thead>
                        <tbody>
                            {archivedPets.map(pet => {
                                const restoreReq = restoreRequests.find(r => r.petId === pet.id);
                                return (
                                <tr key={pet.id} style={{ borderBottom: "1px solid #f1f1f1", background: (pet.deletionStatus === "Pending" || restoreReq) ? "#fff8e1" : "transparent" }}>
                                    <td style={{ padding: "15px", fontWeight: "bold" }}>{pet.name}</td>
                                    <td style={{ padding: "15px" }}>{users.find(u => u.id === pet.ownerId)?.firstName}</td>
                                    <td style={{ padding: "15px" }}>{restoreReq ? "Reactivation Requested" : pet.deletionStatus === "Pending" ? "Deletion Pending" : "Archived"}</td>
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
                            )})}
                        </tbody>
                    </table>
                )}
              </div>
            </div>
          )}
        </div>

        {/* --- CUSTOM MODAL BOX --- */}
        {modal.show && (
            <div className="modal-overlay no-print" style={{position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000}}>
                <div style={{ background: "white", padding: "25px", borderRadius: "12px", width: "400px", textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
                    <h3 style={{margin: "0 0 15px 0", color: "#333"}}>{modal.title}</h3>
                    <p style={{marginBottom: "20px", fontSize: "15px", color: "#555", whiteSpace: "pre-line"}}>{modal.message}</p>
                    {modal.type === "input" && (<textarea value={modal.inputValue} onChange={(e) => setModal({...modal, inputValue: e.target.value})} placeholder="Type here..." style={{width: "100%", height: "80px", padding: "10px", borderRadius: "6px", border: "1px solid #ddd", marginBottom: "20px", resize: "none", fontFamily: "inherit"}} />)}
                    <div style={{display: "flex", justifyContent: "center", gap: "15px"}}>
                        {(modal.type === "confirm" || modal.type === "input") ? (<><button onClick={closeModal} disabled={isProcessing} style={{ padding: "10px 20px", background: "#e0e0e0", color: "#333", border: "none", borderRadius: "6px", cursor: isProcessing ? "not-allowed" : "pointer", fontWeight: "bold" }}>Cancel</button><button disabled={isProcessing} onClick={async () => { if (isProcessing) return; setIsProcessing(true); try { await modal.onConfirm(modal.inputValue); } finally { setIsProcessing(false); } }} style={{ padding: "10px 20px", background: isProcessing ? "#90caf9" : "#2196F3", color: "white", border: "none", borderRadius: "6px", cursor: isProcessing ? "not-allowed" : "pointer", fontWeight: "bold" }}>{isProcessing ? "Processing..." : "Confirm"}</button></>) : (<button onClick={closeModal} style={{ padding: "10px 20px", background: "#2196F3", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>OK</button>)}
                    </div>
                </div>
            </div>
        )}

        {/* --- CONSULTATION FORM MODAL --- */}
        {showConsultModal && (
            <div className="modal-overlay no-print" style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 }}>
                <div style={{ background: "white", padding: "25px", borderRadius: "12px", width: "700px", maxWidth: "95%", maxHeight: "90vh", overflowY: "auto" }}>
                    <h3 style={{ marginTop: 0, color: "#2196F3" }}>Consultation Form</h3>
                    <form onSubmit={handleFinishConsultation} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                        <div style={{ background: "#f9f9f9", padding: "15px", borderRadius: "8px", border: "1px solid #eee" }}>
                            <label style={{ display: "block", marginBottom: "10px" }}><strong>Date:</strong> <input type="date" required value={consultData.date} onChange={e => setConsultData({ ...consultData, date: e.target.value })} style={{ padding: "5px", borderRadius: "4px", border: "1px solid #ddd" }} /></label>
                            <label style={{ display: "block", marginBottom: "5px" }}><strong>Reasons for Visit:</strong></label>
                            {consultData.reasons.map((reason, idx) => (
                                <div key={idx} style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "8px" }}>
                                    <select value={reason.type} onChange={(e) => updateReasonLine(idx, "type", e.target.value)} style={{ flex: 1, padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}>{VISIT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}</select>
                                    {(reason.type === "Vaccination" || reason.type === "Deworming") && (
                                        <><select value={reason.vaccineType} onChange={(e) => updateReasonLine(idx, "vaccineType", e.target.value)} style={{ flex: 1, padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }} required><option value="">Select Type</option>{VACCINE_TYPES.map(vt => <option key={vt} value={vt}>{vt}</option>)}</select><input type="date" placeholder="Next Schedule" value={reason.nextSchedule} onChange={(e) => updateReasonLine(idx, "nextSchedule", e.target.value)} style={{ width: "130px", padding: "7px", borderRadius: "4px", border: "1px solid #ccc" }} /></>
                                    )}
                                    {consultData.reasons.length > 1 && (<button type="button" onClick={() => removeReason(idx)} style={{ color: "red", border: "none", background: "none", cursor: "pointer", fontWeight: "bold" }}>✕</button>)}
                                </div>
                            ))}
                            <button type="button" onClick={addReason} style={{ fontSize: "12px", color: "#2196F3", border: "none", background: "none", cursor: "pointer", fontWeight: "bold" }}>+ Add Another Reason</button>
                        </div>
                        {consultData.reasons.some(r => r.type.includes("Check-up") || r.type === "Emergency") && (
                            <div style={{ border: "1px solid #FF9800", padding: "15px", borderRadius: "8px", background: "#fff3e0" }}>
                                <h4 style={{ marginTop: 0, color: "#bf360c" }}>Check-up Details</h4>
                                <div style={{ marginBottom: "10px" }}>
                                    <strong>Symptoms:</strong>
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "5px", marginTop: "5px" }}>{SYMPTOM_OPTIONS.map(sym => (<label key={sym} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "10px", cursor: "pointer", background: consultData.symptoms.includes(sym) ? "#ffe0b2" : "white", padding: "4px 8px", borderRadius: "4px", border: "1px solid #ffcc80", width: "100%", boxSizing: "border-box" }}><input type="checkbox" checked={consultData.symptoms.includes(sym)} onChange={() => handleSymptomChange(sym)} style={{ cursor: "pointer", accentColor: "#ef6c00", width: "13px", height: "13px", margin: 0 }} />{sym}</label>))}</div>
                                    {consultData.symptoms.includes("Other") && (<input type="text" placeholder="Specify symptoms..." value={consultData.otherSymptom} onChange={e => setConsultData({ ...consultData, otherSymptom: e.target.value })} style={{ width: "100%", padding: "8px", marginTop: "8px", borderRadius: "6px", border: "1px solid #ffcc80", fontSize: "12px" }} />)}
                                </div>
                                <label><strong>Diagnosis:</strong><br /><select value={consultData.diagnosis} onChange={e => setConsultData({ ...consultData, diagnosis: e.target.value })} style={{ width: "100%", padding: "8px", marginTop: "5px", borderRadius: "6px", border: "1px solid #ffcc80" }}><option value="">Select Diagnosis</option>{DIAGNOSIS_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}</select>{consultData.diagnosis === "Other" && (<input type="text" placeholder="Specify diagnosis..." value={consultData.otherDiagnosis} onChange={e => setConsultData({ ...consultData, otherDiagnosis: e.target.value })} style={{ width: "100%", padding: "8px", marginTop: "8px", borderRadius: "6px", border: "1px solid #ffcc80", fontSize: "12px" }} />)}</label>
                            </div>
                        )}
                        <div style={{ border: "1px solid #ddd", padding: "10px", borderRadius: "8px" }}>
                            <label style={{ fontWeight: "bold", fontSize: "14px" }}>Add Treatments/Medicines</label>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "8px", alignItems: "center" }}>
                                <select style={{ flex: 2, minWidth: "200px", padding: "8px" }} value={consultData.tempItemId} onChange={(e) => setConsultData({...consultData, tempItemId: e.target.value, tempDispense: true})}><option value="">-- Select Item --</option>{inventory.filter(i => i.quantity > 0).map(item => (<option key={item.id} value={item.id}>{item.name} ({item.quantity} left)</option>))}<option value="Other">Other / Not in Inventory</option></select>
                                <input type="number" min="1" placeholder="Qty" style={{ width: "60px", padding: "8px" }} value={consultData.tempQty} onChange={(e) => setConsultData({...consultData, tempQty: parseInt(e.target.value) || 1})} />
                                <button type="button" onClick={addItemToPrescription} style={{ background: "#4CAF50", color: "white", border: "none", padding: "8px 15px", borderRadius: "4px", cursor: "pointer" }}>Add</button>
                            </div>
                            {consultData.tempItemId && consultData.tempItemId !== "Other" && (<div style={{ marginTop: "8px", background: "#f9f9f9", padding: "5px 10px", borderRadius: "4px", fontSize: "12px", display: "inline-block" }}><label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", color: "#333" }}><input type="checkbox" checked={consultData.tempDispense} onChange={(e) => setConsultData({ ...consultData, tempDispense: e.target.checked })} /> Dispense & Deduct Stock</label></div>)}
                            {consultData.tempItemId === "Other" && (<textarea placeholder="Specify treatment name..." rows="1" value={consultData.otherMedicine || ""} onChange={e => setConsultData({ ...consultData, otherMedicine: e.target.value })} style={{ width: "100%", padding: "8px", marginTop: "8px", borderRadius: "6px", border: "1px solid #2196F3", fontSize: "12px" }} />)}
                            <div style={{ marginTop: "10px" }}>
                                {consultData.prescriptionList.length === 0 && (<p style={{ fontSize: "12px", color: "#888", fontStyle: "italic" }}>No items added yet.</p>)}
                                {consultData.prescriptionList.map((item, index) => (<div key={index} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px", padding: "6px 0", borderBottom: "1px solid #eee" }}><div><strong>{item.name}</strong> <span style={{color:"#666"}}>x{item.qty}</span>{item.dispense && <span style={{ marginLeft: "8px", fontSize: "11px", color: "green", background: "#e8f5e9", padding: "2px 6px", borderRadius: "4px" }}>Deducting Stock</span>}</div><button type="button" onClick={() => setConsultData({...consultData, prescriptionList: consultData.prescriptionList.filter((_, i) => i !== index)})} style={{ color: "#d32f2f", border: "none", background: "none", cursor: "pointer", fontWeight: "bold", fontSize: "14px" }}>✕</button></div>))}
                            </div>
                        </div>
                        <label><strong>Notes:</strong><br /><textarea value={consultData.notes} onChange={e => setConsultData({ ...consultData, notes: e.target.value })} rows="2" style={{ width: "100%", padding: "8px", marginTop: "5px", borderRadius: "6px", border: "1px solid #ddd" }} placeholder="Additional observations..." /></label>
                        <label style={{ background: "#e3f2fd", padding: "10px", borderRadius: "6px", marginTop: "10px", display: "block" }}><strong>General Follow-up Date (Optional):</strong><br /><input type="date" value={consultData.followUp} onChange={e => setConsultData({ ...consultData, followUp: e.target.value })} style={{ width: "100%", padding: "8px", marginTop: "5px", borderRadius: "6px", border: "1px solid #bbb" }} /></label>
                        <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}><button type="submit" disabled={isProcessing} style={{ flex: 1, background: isProcessing ? "#ccc" : "#4CAF50", color: "white", border: "none", padding: "12px", borderRadius: "6px", cursor: isProcessing ? "not-allowed" : "pointer", fontWeight: "bold" }}>{isProcessing ? "Processing..." : "Finish Consultation"}</button><button type="button" onClick={() => setShowConsultModal(false)} style={{ flex: 1, background: "#ccc", border: "none", padding: "12px", borderRadius: "6px", cursor: "pointer" }}>Cancel</button></div>
                    </form>
                </div>
            </div>
        )}

        {/* --- CHART MODAL --- */}
        {showChartModal && (
            <div className="modal-overlay no-print" style={{position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1100}}>
                <div style={{ background: "white", padding: "30px", borderRadius: "12px", width: "900px", maxWidth: "95%", height: "600px", display: "flex", flexDirection: "column" }}>
                     <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px"}}><h3 style={{margin: 0}}>Full Pet Breed Distribution</h3><button onClick={() => setShowChartModal(false)} style={{background: "transparent", border: "none", fontSize: "24px", cursor: "pointer", color: "#999"}}>✕</button></div>
                     <div style={{flex: 1, minHeight: 0}}><SimpleBarChart data={breedChartData} title="" hideLabels={false} /></div>
                </div>
            </div>
        )}

        {/* PRINT MODAL (General List) */}
        {showPrintModal && (
            <div className="modal-overlay no-print" style={{position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000}}>
                <div style={{ background: "white", padding: "25px", borderRadius: "12px", width: "500px", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
                    <h3 style={{marginTop: 0}}>Select Pets to Print</h3>
                    <div style={{ marginBottom: "10px" }}><button onClick={handleSelectAllForPrint} style={{ padding: "5px 10px", fontSize: "12px", cursor: "pointer" }}>{selectedPetsForPrint.length === pets.length ? "Deselect All" : "Select All"}</button></div>
                    <div style={{ flex: 1, overflowY: "auto", border: "1px solid #eee", padding: "10px", borderRadius: "6px", marginBottom: "15px" }}>{pets.map(pet => (<div key={pet.id} onClick={() => togglePetSelection(pet.id)} style={{ padding: "8px", borderBottom: "1px solid #f9f9f9", display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", background: selectedPetsForPrint.includes(pet.id) ? "#e3f2fd" : "white" }}><div style={{ width: "16px", height: "16px", borderRadius: "3px", border: "1px solid #ccc", background: selectedPetsForPrint.includes(pet.id) ? "#2196F3" : "white", display: "flex", alignItems: "center", justifyContent: "center" }}>{selectedPetsForPrint.includes(pet.id) && <span style={{color: "white", fontSize: "12px"}}>✓</span>}</div><span>{pet.name}</span></div>))}</div>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}><button onClick={() => setShowPrintModal(false)} style={{ padding: "10px 20px", background: "#eee", border: "none", borderRadius: "6px", cursor: "pointer" }}>Cancel</button><button onClick={executePrintList} disabled={selectedPetsForPrint.length === 0} style={{ padding: "10px 20px", background: "#2196F3", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", opacity: selectedPetsForPrint.length === 0 ? 0.5 : 1 }}>Print</button></div>
                </div>
            </div>
        )}

        {/* --- PRINT CONTENT AREA --- */}
        <div className="print-only bond-paper">
            {/* Header */}
            <div className="print-header">
                <h1 style={{ margin: "0", fontSize: "24px", color: "#333" }}>PawPals Veterinary Clinic</h1>
                <p style={{ margin: "5px 0", color: "#666" }}>123 Pet Street, Animal City • (555) 123-4567</p>
                <div style={{ borderBottom: "2px solid #333", margin: "10px 0" }}></div>
            </div>

            {/* SCENARIO 1: APPOINTMENTS LIST */}
            {printType === "appointments" && (
                <>
                    <h2 style={{ textAlign: "center", fontSize: "18px" }}>Appointment History Report</h2>
                    <table className="print-table">
                        <thead><tr><th>Date</th><th>Pet</th><th>Owner</th><th>Service</th><th>Status</th></tr></thead>
                        <tbody>
                            {filteredAppointments.map(appt => (
                                <tr key={appt.id}><td>{appt.date}</td><td>{pets.find(p => p.id === appt.petId)?.name || "Unknown"}</td><td>{users.find(u => u.id === appt.userId)?.firstName}</td><td>{appt.reason}</td><td>{appt.status}</td></tr>
                            ))}
                        </tbody>
                    </table>
                </>
            )}

            {/* SCENARIO 2: GENERAL PET LIST (Updated with Contact) */}
            {printType === "pets_list" && (
                <>
                    <h2 style={{ textAlign: "center", fontSize: "18px" }}>Registered Pets Report</h2>
                    <table className="print-table">
                        <thead><tr><th>Pet Name</th><th>Species/Breed</th><th>Birthdate</th><th>Age/Gender</th><th>Owner Name</th><th>Contact</th></tr></thead>
                        <tbody>
                            {pets.filter(p => selectedPetsForPrint.includes(p.id)).map(pet => (
                                <tr key={pet.id}>
                                    <td>{pet.name}</td>
                                    <td>{pet.species} / {pet.breed}</td>
                                    <td>{pet.birthdate || "N/A"}</td> {/* <--- ADD THIS COLUMN */}
                                    <td>{pet.age} / {pet.gender}</td>
                                    <td>{users.find(u => u.id === pet.ownerId)?.firstName}</td>
                                    <td>
                                        {(() => {
                                            const u = users.find(owner => owner.id === pet.ownerId);
                                            return u ? (u.phone || u.phoneNumber || u.email) : "N/A";
                                        })()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </>
            )}

            {/* SCENARIO 3: SPECIFIC PET MEDICAL HISTORY */}
            {printType === "history_single" && viewingRecord && (
                <div className="print-page">
                    <h2 style={{ textAlign: "center", fontSize: "20px", marginBottom: "5px", textTransform: "uppercase" }}>Medical History Record</h2>
                    
                    <div style={{ border: "1px solid #999", padding: "10px", margin: "15px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "14px" }}>
                        <div><strong>Patient Name:</strong> {viewingRecord.name}</div>
                        <div><strong>Species/Breed:</strong> {viewingRecord.species} / {viewingRecord.breed}</div>
                        <div><strong>Owner:</strong> {users.find(u => u.id === viewingRecord.ownerId)?.firstName || "N/A"}</div>
                        <div><strong>Birthdate:</strong> {viewingRecord.birthdate || "N/A"} ({viewingRecord.age} {viewingRecord.ageUnit}) / {viewingRecord.gender}</div>
                    </div>

                    <table className="print-table">
                        <thead>
                            <tr>
                                <th style={{width: "15%"}}>Date</th>
                                <th style={{width: "20%"}}>Diagnosis</th>
                                <th style={{width: "40%"}}>Treatment / Medicine</th>
                                <th style={{width: "25%"}}>Notes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {medicalRecords.filter(r => r.petId === viewingRecord.id)
                                .sort((a, b) => new Date(b.date) - new Date(a.date))
                                .map(record => (
                                <tr key={record.id}>
                                    <td style={{verticalAlign: "top"}}>{record.date}</td>
                                    <td style={{verticalAlign: "top"}}><strong>{record.diagnosis}</strong></td>
                                    <td style={{verticalAlign: "top"}}>
                                        {record.prescriptionDetails ? (
                                            <ul style={{margin:0, paddingLeft:"15px"}}>{record.prescriptionDetails.map((p,i)=><li key={i}>{p.name} ({p.qty})</li>)}</ul>
                                        ) : (
                                            record.treatment || record.medicine || "-"
                                        )}
                                    </td>
                                    <td style={{verticalAlign: "top", fontStyle:"italic"}}>{record.notes}</td>
                                </tr>
                            ))}
                            {medicalRecords.filter(r => r.petId === viewingRecord.id).length === 0 && (
                                <tr><td colSpan="4" style={{textAlign:"center", padding:"20px"}}>No medical records found.</td></tr>
                            )}
                        </tbody>
                    </table>
                    
                    <div style={{ marginTop: "30px", fontSize: "12px", borderTop: "1px solid #ccc", paddingTop: "5px", textAlign: "center" }}>
                        PawPals System Generated Record
                    </div>
                </div>
            )}
        </div>
      </main>

      {/* --- STYLES --- */}
      <style>{`
          .no-print { display: block; }
          .print-only { display: none; }

          @media print {
              .no-print, nav, .main-content > div:first-child, .action-btn, .modal-overlay, button, input, select { display: none !important; }
              body, html, #root, .dashboard-container, .main-content {
                  background: white !important;
                  height: auto !important;
                  width: 100% !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  overflow: visible !important;
                  position: static !important;
              }
              .print-only {
                  display: block !important;
                  position: absolute;
                  top: 0; left: 0; width: 100%;
                  margin: 0; padding: 20px;
                  box-sizing: border-box;
                  font-family: "Helvetica", "Arial", sans-serif;
                  color: black; font-size: 12px;
              }
              .print-page { page-break-after: always; margin-bottom: 20px; }
              .print-page:last-child { page-break-after: auto; }
              .print-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              .print-table th, .print-table td { border: 1px solid #000; padding: 6px; text-align: left; font-size: 11px; }
              .print-table th { background-color: #f0f0f0 !important; font-weight: bold; -webkit-print-color-adjust: exact; }
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
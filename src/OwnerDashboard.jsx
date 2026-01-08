import { useEffect, useState, useRef } from "react";
import { auth, db } from "./firebase";
import { signOut, updatePassword } from "firebase/auth";
import { collection, addDoc, query, where, onSnapshot, orderBy, doc, updateDoc, getDoc, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import logoImg from "./assets/logo.png";
import EditPetModal from "./EditPetModal";

// --- CONSTANTS ---
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

// --- HELPER: TIME CONVERSION ---
const getTimeInMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours * 60) + minutes;
};

// --- HELPER: REQUIREMENT ITEM (For Password) ---
const RequirementItem = ({ fulfilled, text }) => (
    <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", color: fulfilled ? "#4CAF50" : "#999" }}>
        <span style={{ fontSize: "12px" }}>{fulfilled ? "✔" : "○"}</span>
        <span>{text}</span>
    </div>
);

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

const OwnerDashboard = () => {
  const navigate = useNavigate();
  const user = auth.currentUser;
  const scrollRef = useRef();

  const [activeTab, setActiveTab] = useState("pets");
  const [apptFilter, setApptFilter] = useState("Approved")
  const [requestEditPet, setRequestEditPet] = useState(null);;

  // --- MOBILE SUB-TAB STATES ---
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [apptSubTab, setApptSubTab] = useState("request"); 
  
  // --- PET SUB-TAB STATE (For Medical Records) ---
  const [petSubTab, setPetSubTab] = useState("list"); // 'list' or 'records'
  const [recordFilterPetId, setRecordFilterPetId] = useState("all"); // Filter for records

  // Toast State
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const showToast = (message, type = "success") => {
      setToast({ show: true, message, type });
      setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  };

  // Data States
  const [myPets, setMyPets] = useState([]);
  const [myAppointments, setMyAppointments] = useState([]);
  
  // --- NOTIFICATION STATES ---
  const [serverNotifications, setServerNotifications] = useState([]);
  const [localReminders, setLocalReminders] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  
  // --- NEW: TRACK ALERTS TO PREVENT SPAM ---
  const [notifiedAppts, setNotifiedAppts] = useState(new Set());
  
  // UI States
  const [chatInput, setChatInput] = useState("");
  const [petSearch, setPetSearch] = useState("");
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  
  // --- LOADING/SAVING LOCK ---
  const [isSaving, setIsSaving] = useState(false);

  // --- CHAT EDIT STATE ---
  const [editingMessageId, setEditingMessageId] = useState(null);

  // --- MODAL STATES ---
  const [showPetModal, setShowPetModal] = useState(false);
  const [isEditingPet, setIsEditingPet] = useState(false);
  const [editingPetId, setEditingPetId] = useState(null);

  // --- DELETE REQUEST MODAL STATE ---
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteData, setDeleteData] = useState({ id: null, name: "", reason: "" });

  // --- CANCEL APPOINTMENT MODAL STATE ---
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelData, setCancelData] = useState({ id: null, reason: "" });

  // --- MEDICAL RECORD MODAL STATES ---
  const [showMedicalModal, setShowMedicalModal] = useState(false); 
  const [selectedRecord, setSelectedRecord] = useState(null);

  // --- RESCHEDULE STATE ---
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleData, setRescheduleData] = useState({ id: null, date: "", time: "08:00" });

  // --- LOGOUT CONFIRMATION STATE ---
  const [confirmModal, setConfirmModal] = useState({ 
      show: false, 
      message: "", 
      onConfirm: () => {} 
  });

  // Profile Data
  const [profileData, setProfileData] = useState({ firstName: "", lastName: "", email: "", phone: "", address: "" });
  const [newPassword, setNewPassword] = useState(""); 
  
  // --- PASSWORD VALIDATION STATE ---
  const [passwordValidations, setPasswordValidations] = useState({
    hasLower: false, hasUpper: false, hasNumber: false, hasSymbol: false, hasLength: false
  });

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
  const [apptDate, setApptDate] = useState("");
  const [apptTime, setApptTime] = useState("08:00");

  // --- COMBINE NOTIFICATIONS ---
  const allNotifications = [...localReminders, ...serverNotifications];
  const unreadCount = allNotifications.filter(n => !n.isSeenByOwner).length;

  // --- CHECK PASSWORD VALIDITY ON CHANGE ---
  useEffect(() => {
    setPasswordValidations({
      hasLower: /[a-z]/.test(newPassword),
      hasUpper: /[A-Z]/.test(newPassword),
      hasNumber: /\d/.test(newPassword),
      hasSymbol: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword),
      hasLength: newPassword.length >= 8
    });
  }, [newPassword]);

  // --- CHECK FOR UPCOMING APPOINTMENTS (1 HOUR REMINDER) ---
  useEffect(() => {
      const checkUpcoming = () => {
          if (!myAppointments.length) return;

          const now = new Date();

          myAppointments.forEach(appt => {
              if (appt.status === "Approved" && !notifiedAppts.has(appt.id)) {
                  
                  const apptDateTime = new Date(`${appt.date}T${appt.time}`);
                  const diffMs = apptDateTime - now;
                  const diffMins = Math.floor(diffMs / 60000);

                  if (diffMins > 0 && diffMins <= 60) {
                      showToast(`🔔 Reminder: Appointment for ${appt.petName} is in ${diffMins} minutes!`, "success");
                      
                      const newAlert = {
                          id: `reminder-${appt.id}`,
                          type: "alert",
                          text: `⏰ UPCOMING: Your appointment for ${appt.petName} is in ${diffMins} minutes.`,
                          isSeenByOwner: false,
                          status: "Approved"
                      };

                      setLocalReminders(prev => [newAlert, ...prev]);
                      setNotifiedAppts(prev => new Set(prev).add(appt.id));
                  }
              }
          });
      };

      checkUpcoming();
      const interval = setInterval(checkUpcoming, 60000); 
      return () => clearInterval(interval);
  }, [myAppointments, notifiedAppts]);

  // --- LISTENER TO DETECT MOBILE SCREEN ---
  useEffect(() => {
      const handleResize = () => setIsMobile(window.innerWidth <= 768);
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
  }, []);

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
            .filter(pet => !pet.isArchived)
            .sort((a, b) => a.name.localeCompare(b.name)); 

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
        
        const alerts = appts.filter(a => a.status !== "Pending").map(a => {
            let text = `Your appointment for ${a.petName} on ${a.date} is ${a.status}.`;
            if (a.status === "Cancelled" && a.cancellationReason) {
                text += ` Reason: ${a.cancellationReason}`;
            }
            return {
                id: a.id, 
                type: "alert", 
                text: text,
                isSeenByOwner: a.isSeenByOwner,
                status: a.status
            };
        });
        setServerNotifications(alerts);
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

  useEffect(() => {
      if (activeTab === "chat" && chatMessages.length > 0) {
          const unreadMsgs = chatMessages.filter(m => !m.read && m.senderId !== user.uid);
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
  }, [activeTab, chatMessages, user.uid]);

  const filteredPets = myPets.filter(pet => pet.name.toLowerCase().includes(petSearch.toLowerCase()));
  
  const filteredAppointments = myAppointments.filter(appt => {
      return appt.status === apptFilter;
  });

const medicalRecords = myAppointments.filter(appt => 
    appt.diagnosis && appt.diagnosis !== "" && 
    (recordFilterPetId === 'all' || appt.petId === recordFilterPetId)
);

  const handleToggleNotifications = () => {
      setShowNotifDropdown(!showNotifDropdown);
      if (!showNotifDropdown) {
          serverNotifications.filter(n => !n.isSeenByOwner).forEach(async (item) => {
              await updateDoc(doc(db, "appointments", item.id), { isSeenByOwner: true });
          });
          setLocalReminders(prev => prev.map(n => ({...n, isSeenByOwner: true})));
      }
  };

  const handleNotificationClick = (notif) => {
      setShowNotifDropdown(false);
      if (notif.type === "alert") {
          setActiveTab("appointments");
          setApptSubTab("list");
          if (notif.status) {
              setApptFilter(notif.status); 
          }
      }
  };

  const openDeleteModal = (petId, petName) => {
      setDeleteData({ id: petId, name: petName, reason: "" });
      setShowDeleteModal(true);
  };

  const handleConfirmDelete = async (e) => {
      e.preventDefault();
      if (!deleteData.reason.trim()) return showToast("Please provide a reason.", "error");
      
      if (isSaving) return; 
      setIsSaving(true);

      try {
          await updateDoc(doc(db, "pets", deleteData.id), { 
              deletionStatus: "Pending", 
              deletionReason: deleteData.reason 
          });
          showToast("Deletion request sent to Admin for approval.");
          setShowDeleteModal(false);
      } catch (error) { 
          console.error(error); 
          showToast("Error sending request.", "error"); 
      } finally {
          setIsSaving(false); 
      }
  };

  const openCancelModal = (apptId) => {
      setCancelData({ id: apptId, reason: "" });
      setShowCancelModal(true);
  };

  const handleConfirmCancel = async (e) => {
      e.preventDefault();
      if (!cancelData.reason.trim()) return showToast("Please provide a reason.", "error");

      if (isSaving) return; 
      setIsSaving(true);

      try {
          await updateDoc(doc(db, "appointments", cancelData.id), { 
              status: "Cancelled",
              cancellationReason: cancelData.reason 
          });
          showToast("Appointment Cancelled.", "error");
          setShowCancelModal(false);
      } catch (error) {
          console.error(error);
          showToast("Error cancelling.", "error");
      } finally {
          setIsSaving(false); 
      }
  };

  const handleViewMedicalRecord = (appt) => {
      setSelectedRecord(appt);
      setShowMedicalModal(true);
  };

  const handleViewPetHistory = (petId) => {
      setRecordFilterPetId(petId);
      setPetSubTab("records");
  };
  
  const handlePrintRecord = (record) => {
      const printWindow = window.open('', '', 'height=800,width=800');
      printWindow.document.write('<html><head><title>Medical Record - PawPals</title>');
      printWindow.document.write('<style>body{font-family: sans-serif; padding: 20px;} .header{text-align:center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px;} .section{margin-bottom: 15px;} .label{font-weight: bold; color: #555;} .footer{margin-top: 50px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #ccc; padding-top: 10px;}</style>');
      printWindow.document.write('</head><body>');
      
      printWindow.document.write('<div class="header">');
      printWindow.document.write('<h1>PawPals Clinic</h1>');
      printWindow.document.write('<p>Veterinary Medical Record</p>');
      printWindow.document.write('</div>');

      printWindow.document.write('<div class="section"><p><span class="label">Patient Name:</span> ' + record.petName + '</p>');
      printWindow.document.write('<p><span class="label">Owner Name:</span> ' + (profileData.firstName + " " + profileData.lastName) + '</p></div>');
      
      printWindow.document.write('<hr/>');

      printWindow.document.write('<div class="section"><p><span class="label">Date of Visit:</span> ' + record.date + '</p>');
      printWindow.document.write('<p><span class="label">Reason for Visit:</span> ' + (record.reason || "N/A") + '</p></div>');

      printWindow.document.write('<div class="section"><p><span class="label">Symptoms:</span> ' + (record.symptoms || "None") + '</p></div>');
      
      printWindow.document.write('<div class="section" style="background: #f0f8ff; padding: 10px; border-radius: 5px;">');
      printWindow.document.write('<p><span class="label">Diagnosis:</span> ' + (record.diagnosis || "N/A") + '</p></div>');

      printWindow.document.write('<div class="section" style="border: 1px solid #333; padding: 15px; margin-top: 20px;">');
      printWindow.document.write('<h3 style="margin-top:0;">💊 Prescription (Rx)</h3>');
      printWindow.document.write('<p>' + (record.medicine || "No medications prescribed.") + '</p></div>');

      printWindow.document.write('<div class="section"><p><span class="label">Veterinarian Notes:</span> ' + (record.notes || "N/A") + '</p></div>');
      printWindow.document.write('<div class="footer">This document is a computer-generated medical record from PawPals System.</div>');
      
      printWindow.document.write('</body></html>');
      printWindow.document.close();
      printWindow.print();
  };

  const openRescheduleModal = (appt) => {
      setRescheduleData({
          id: appt.id,
          date: appt.date,
          time: appt.time
      });
      setShowRescheduleModal(true);
  };

  const handleRescheduleSubmit = async (e) => {
      e.preventDefault();
      if (isSaving) return; 
      setIsSaving(true);

      try {
        const now = new Date();
        const selectedDateTime = new Date(rescheduleData.date);
        const [hours, minutes] = rescheduleData.time.split(':');
        selectedDateTime.setHours(hours, minutes, 0, 0);

        if (selectedDateTime.getDay() === 6) throw new Error("Sorry, the clinic is closed on Saturdays.");
        if (selectedDateTime < now) throw new Error("Please select a future date and time.");

        const newStart = getTimeInMinutes(rescheduleData.time);
        const newEnd = newStart + 60; 

        const qConflict = query(collection(db, "appointments"), where("date", "==", rescheduleData.date));
        const snapshot = await getDocs(qConflict);

        const hasConflict = snapshot.docs.some(doc => {
            if (doc.id === rescheduleData.id) return false; 
            const data = doc.data();
            if (data.status === "Cancelled" || data.status === "Rejected") return false;

            const existingStart = getTimeInMinutes(data.time);
            const existingEnd = existingStart + 60;
            return (newStart < existingEnd && newEnd > existingStart);
        });

        if (hasConflict) throw new Error(`CONFLICT: The slot ${rescheduleData.time} (or one near it) is already booked.`);

        await updateDoc(doc(db, "appointments", rescheduleData.id), {
            date: rescheduleData.date,
            time: rescheduleData.time,
            status: "Pending", 
            isSeenByOwner: false
        });
        
        showToast("Appointment Rescheduled! It is now Pending approval.");
        setShowRescheduleModal(false);
      } catch (error) {
        console.error(error);
        showToast(error.message, "error");
      } finally {
        setIsSaving(false); 
      }
  };

  const handleSaveProfile = async (e) => {
      e.preventDefault();

      // --- 1. NAME VALIDATION (Only Letters & Spaces) ---
      const nameRegex = /^[a-zA-Z\s]+$/;
      if (!nameRegex.test(profileData.firstName) || !nameRegex.test(profileData.lastName)) {
          showToast("Names must contain only letters (no numbers or symbols).", "error");
          return;
      }

      // --- 2. PASSWORD VALIDATION (If Changed) ---
      if (newPassword.trim()) {
          const { hasLower, hasUpper, hasNumber, hasSymbol, hasLength } = passwordValidations;
          if (!hasLower || !hasUpper || !hasNumber || !hasSymbol || !hasLength) {
              showToast("Password does not meet the security requirements.", "error");
              return;
          }
      }

      if (isSaving) return;
      setIsSaving(true);
      
      try {
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, { 
            firstName: profileData.firstName, 
            lastName: profileData.lastName, 
            phone: profileData.phone || "", 
            address: profileData.address || "" 
        });

        if (newPassword.trim()) {
            await updatePassword(user, newPassword);
            setNewPassword(""); 
            showToast("Profile & Password Updated Successfully!");
        } else {
            showToast("Profile Information Updated!");
        }
     } catch (error) {
          console.error(error);
          if (error.code === 'auth/requires-recent-login') {
              showToast("Security: Please Log Out and Log In again to change password.", "error");
          } else {
              showToast(error.message || "Error updating profile", "error");
          }
     } finally {
           setIsSaving(false);
        }
    };

  const resetPetForm = () => {
    setPetName(""); setBreed(""); setOtherBreed(""); setAge(""); setAgeUnit("Years");
    setOtherSpecies(""); setSpecies("Dog"); setGender("Male"); setMedicalHistory(""); 
    setIsEditingPet(false); setEditingPetId(null);
  };

  const openAddPetModal = () => { resetPetForm(); setShowPetModal(true); };
  const handlePetSubmit = async (e) => {
    e.preventDefault();
    if (isSaving) return; 

    const finalSpecies = species === "Other" ? otherSpecies : species;
    if (!finalSpecies.trim()) return showToast("Please specify the species.", "error");

    let finalBreed = breed;
    if (["Dog", "Cat"].includes(species)) {
        if (breed === "Other") finalBreed = otherBreed;
        if (!finalBreed.trim()) return showToast("Please specify the breed.", "error");
    } else {
        if (breed === "Other") finalBreed = otherBreed; // Handle generic other
        if (!finalBreed || !finalBreed.trim()) finalBreed = "N/A";
    }

    setIsSaving(true); 

    try {
        const petData = { 
            name: petName, species: finalSpecies, breed: finalBreed, 
            age: Number(age), ageUnit, gender, medicalHistory, ownerId: user.uid, updatedAt: new Date()
        };

        if (isEditingPet && editingPetId) {
            await updateDoc(doc(db, "pets", editingPetId), petData);
            showToast("Pet Updated Successfully!");
        } else {
            petData.createdAt = new Date();
            await addDoc(collection(db, "pets"), petData);
            showToast("Pet Added Successfully!");
        }
        setShowPetModal(false); 
        resetPetForm();
    } catch (error) {
        console.error(error);
        showToast("Error saving pet.", "error");
    } finally {
        setIsSaving(false); 
    }
  };
  
  const handleBookAppointment = async (e) => {
      e.preventDefault();
      if (!selectedPetId) return showToast("Please add a pet first!", "error");
      if (!apptDate) return showToast("Please select a date.", "error");
      
      if (isSaving) return; 
      setIsSaving(true);

      try {
        const now = new Date();
        const selectedDateTime = new Date(apptDate);
        const [hours, minutes] = apptTime.split(':');
        selectedDateTime.setHours(hours, minutes, 0, 0);

        if (selectedDateTime.getDay() === 6) throw new Error("Sorry, the clinic is closed on Saturdays.");
        if (selectedDateTime < now) throw new Error("Please select a future date and time.");

        const newStart = getTimeInMinutes(apptTime);
        const newEnd = newStart + 60; 

        const qConflict = query(collection(db, "appointments"), where("date", "==", apptDate));
        const snapshot = await getDocs(qConflict);

        const hasConflict = snapshot.docs.some(doc => {
            const data = doc.data();
            if (data.status === "Cancelled" || data.status === "Rejected") return false;

            const existingStart = getTimeInMinutes(data.time);
            const existingEnd = existingStart + 60;
            return (newStart < existingEnd && newEnd > existingStart);
        });

        if (hasConflict) throw new Error(`CONFLICT: The slot ${apptTime} (or one near it) is already booked.`);

        const pet = myPets.find(p => p.id === selectedPetId);

        await addDoc(collection(db, "appointments"), {
            ownerId: user.uid, 
            petId: selectedPetId, 
            petName: pet ? pet.name : "Unknown",
            date: apptDate, 
            time: apptTime, 
            reason: "Check-up", 
            status: "Pending", 
            createdAt: new Date(), 
            isSeenByOwner: false
        });
        showToast("Appointment Requested!");
        setApptFilter("Pending");
        setApptDate("");
        setApptTime("08:00");
      } catch (error) {
        showToast(error.message, "error");
      } finally {
        setIsSaving(false); 
      }
  };

  const handleStartEdit = (msg) => { setEditingMessageId(msg.id); setChatInput(msg.text); };
  const handleCancelEdit = () => { setEditingMessageId(null); setChatInput(""); };

  const handleSendMessage = async (e) => { 
      e.preventDefault(); 
      if(!chatInput.trim()) return; 

      if (isSaving) return; // Prevent multiple sends
      setIsSaving(true);

      try {
        if (editingMessageId) {
            await updateDoc(doc(db, "messages", editingMessageId), { text: chatInput, isEdited: true });
            setEditingMessageId(null);
            setChatInput("");
            return;
        }

        let shouldAutoReply = false;
        const now = new Date();
        
        if (chatMessages.length === 0) {
            shouldAutoReply = true;
        } else {
            const lastMsg = chatMessages[chatMessages.length - 1];
            const lastTime = lastMsg.createdAt?.toDate ? lastMsg.createdAt.toDate() : new Date(lastMsg.createdAt);
            const diffMs = now - lastTime;
            const twoHoursMs = 2 * 60 * 60 * 1000;
            
            if (diffMs >= twoHoursMs) {
                shouldAutoReply = true;
            }
        }

        await addDoc(collection(db, "messages"), { 
            text: chatInput, senderId: user.uid, senderName: "Owner", receiverId: "STAFF_global", createdAt: now, participants: [user.uid], type: "chat", read: false 
        }); 
        
        if (shouldAutoReply) {
            setTimeout(async () => {
                await addDoc(collection(db, "messages"), {
                    text: "Thank you for contacting us! Our staff has been notified and will reply shortly.",
                    senderId: "STAFF_global",
                    senderName: "System",
                    receiverId: user.uid,
                    createdAt: new Date(),
                    participants: [user.uid],
                    type: "chat",
                    read: false
                });
            }, 1000);
        }

        setChatInput(""); 
      } catch (error) {
        console.error("Error sending message:", error);
      } finally {
        setIsSaving(false);
      }
  };

  const handleLogout = () => { setConfirmModal({show: true, message: "Are you sure you want to log out?", onConfirm: async () => {await signOut(auth); navigate("/");}
    }); 
  };

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

  const getStatusColor = (status) => {
    switch(status) {
        case 'Approved': return '#4CAF50';
        case 'Pending': return '#FF9800';
        case 'Cancelled': return '#f44336';
        case 'Done': return '#2196F3';
        default: return '#999';
    }
  };

  // Helper styles for form elements
  const inputStyle = {
      padding: "12px",
      borderRadius: "8px",
      border: "1px solid #ddd",
      fontSize: "14px",
      width: "100%",
      boxSizing: "border-box",
      outline: "none",
      transition: "border 0.2s"
  };

  // NEW: CUSTOM STYLE FOR DROPDOWNS TO SHOW DOWN ARROW
  const selectStyle = {
      ...inputStyle,
      appearance: "none",
      WebkitAppearance: "none",
      MozAppearance: "none",
      backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%23666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>')`,
      backgroundRepeat: "no-repeat",
      backgroundPosition: "right 10px center",
      backgroundSize: "16px",
      paddingRight: "35px",
      cursor: "pointer",
      backgroundColor: "white" 
  };

  const labelStyle = {
      display: "block",
      marginBottom: "6px",
      fontSize: "13px",
      fontWeight: "bold",
      color: "#444"
  };

  if (!user) return <div style={{padding:"50px", textAlign:"center"}}>Loading user data...</div>;

  return (
    <div className="dashboard-container" style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f5f5" }}>
      
      {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({...toast, show: false})} />}

      {/* --- Navbar --- */}
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
                            {allNotifications.length === 0 ? <p style={{color:"#888"}}>No updates.</p> : allNotifications.map(n => (
                                <div key={n.id} onClick={() => handleNotificationClick(n)} style={{ padding:"10px", borderBottom:"1px solid #f0f0f0", fontSize:"14px", background: n.isSeenByOwner ? "white" : "#e3f2fd", cursor: "pointer", transition: "background 0.2s" }} onMouseOver={(e) => e.currentTarget.style.background = "#f5f5f5"} onMouseOut={(e) => e.currentTarget.style.background = n.isSeenByOwner ? "white" : "#e3f2fd"} >
                                    {n.text}
                                </div>
                            ))}
                        </div>
                        <button onClick={() => setShowNotifDropdown(false)} style={{width:"100%", marginTop:"10px", padding:"8px", background:"#f5f5f5", border:"none", borderRadius:"6px"}}>Close</button>
                    </div>
                )}
            </div>
            <button onClick={handleLogout} className="action-btn" style={{background: "#ffebee", color: "#d32f2f"}}>Logout</button>
        </div>
      </nav>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="main-content" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "20px", maxWidth: "1200px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        
        {/* --- Tab Grid --- */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "20px", marginBottom: "20px", flexShrink: 0 }}>
          <button style={getTabStyle("pets")} onClick={() => setActiveTab("pets")}>My Pets</button>
          <button style={getTabStyle("appointments")} onClick={() => setActiveTab("appointments")}>Appointments</button>
          <button style={getTabStyle("chat")} onClick={() => setActiveTab("chat")}>Messages {incomingMsgCount > 0 && <span style={{background:"red", color:"white", borderRadius:"50%", padding:"2px 8px", fontSize:"12px"}}>{incomingMsgCount}</span>}</button>
          <button style={getTabStyle("profile")} onClick={() => setActiveTab("profile")}>My Profile</button>
        </div>

        {/* --- DYNAMIC CONTENT WRAPPER --- */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

            {/* --- PROFILE TAB --- */}
            {activeTab === "profile" && (
                <div className="card" style={{ width: "100%", height: "100%", padding: "30px", boxSizing: "border-box", overflowY: "auto" }}>
                     <h3 style={{marginTop:0, borderBottom:"1px solid #eee", paddingBottom:"10px", color: "#2196F3"}}>👤 Edit Profile</h3>
                     <form onSubmit={handleSaveProfile} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", maxWidth: "800px", margin: "0 auto" }}>
                        <div>
                            <label style={{ fontSize: "14px", fontWeight: "bold", color:"#555" }}>First Name</label>
                            <input type="text" value={profileData.firstName} onChange={(e) => setProfileData({...profileData, firstName: e.target.value})} required style={{width:"100%", padding:"12px", marginTop:"5px", border:"1px solid #ddd", borderRadius:"8px", fontSize: "14px"}} />
                        </div>
                        <div>
                            <label style={{ fontSize: "14px", fontWeight: "bold", color:"#555" }}>Last Name</label>
                            <input type="text" value={profileData.lastName} onChange={(e) => setProfileData({...profileData, lastName: e.target.value})} required style={{width:"100%", padding:"12px", marginTop:"5px", border:"1px solid #ddd", borderRadius:"8px", fontSize: "14px"}} />
                        </div>
                        <div>
                            <label style={{ fontSize: "14px", fontWeight: "bold", color:"#555" }}>Email Address</label>
                            <input type="email" value={profileData.email || user.email || ""} readOnly disabled style={{width:"100%", padding:"12px", marginTop:"5px", border:"1px solid #ddd", borderRadius:"8px", background: "#f9f9f9", color: "#666"}} />
                        </div>
                        <div>
                            <label style={{ fontSize: "14px", fontWeight: "bold", color:"#555" }}>Phone Number</label>
                            <input type="text" value={profileData.phone} onChange={(e) => setProfileData({...profileData, phone: e.target.value})} style={{width:"100%", padding:"12px", marginTop:"5px", border:"1px solid #ddd", borderRadius:"8px", fontSize: "14px"}} />
                        </div>
                        <div style={{ gridColumn: "1 / -1" }}>
                            <label style={{ fontSize: "14px", fontWeight: "bold", color:"#555" }}>Home Address</label>
                            <input type="text" value={profileData.address} onChange={(e) => setProfileData({...profileData, address: e.target.value})} style={{width:"100%", padding:"12px", marginTop:"5px", border:"1px solid #ddd", borderRadius:"8px", fontSize: "14px"}} />
                        </div>
                        <div style={{ gridColumn: "1 / -1", background:"#e3f2fd", padding:"20px", borderRadius:"8px", border:"1px solid #bbdefb" }}>
                            <label style={{ fontSize: "14px", fontWeight: "bold", color:"#1565C0" }}>Change Password (Optional)</label>
                            <input type="password" placeholder="Enter new password to update..." value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={{width:"100%", padding:"12px", marginTop:"8px", marginBottom:"10px", border:"1px solid #90caf9", borderRadius:"8px", background:"white"}} />
                            
                            {/* COMPACT CHECKLIST */}
                            <div style={{ background: "#f9f9f9", padding: "8px 12px", borderRadius: "6px", border: "1px solid #eee" }}>
                                <p style={{ margin: "0 0 5px", fontSize: "12px", fontWeight: "bold", color: "#555", textAlign: "left" }}>Password Requirements:</p>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "2px 8px" }}>
                                    <RequirementItem fulfilled={passwordValidations.hasLower} text="Lowercase" />
                                    <RequirementItem fulfilled={passwordValidations.hasUpper} text="Uppercase" />
                                    <RequirementItem fulfilled={passwordValidations.hasNumber} text="Number" />
                                    <RequirementItem fulfilled={passwordValidations.hasSymbol} text="Symbol" />
                                    <RequirementItem fulfilled={passwordValidations.hasLength} text="8+ Chars" />
                                </div>
                            </div>
                            
                            <div style={{fontSize:"12px", color:"#555", marginTop:"5px"}}>Leave blank if you don't want to change it.</div>
                        </div>
                        <div style={{ gridColumn: "1 / -1", marginTop: "10px" }}>
                            <button type="submit" style={{ background: "#2196F3", color: "white", width: "100%", padding: "15px", borderRadius: "8px", border: "none", fontSize: "16px", fontWeight: "bold", cursor: "pointer" }}>
                                {isSaving ? "Saving..." : "💾 Save Changes"}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* --- PETS TAB & MEDICAL RECORDS SUB-TAB --- */}
            {activeTab === "pets" && (
                <div className="card" style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: "20px", boxSizing: "border-box" }}>
                    
                    {/* --- NEW: SUB-TAB NAVIGATION --- */}
                    <div style={{display: "flex", gap: "10px", marginBottom: "20px", borderBottom: "1px solid #eee", paddingBottom: "10px"}}>
                        <button onClick={() => setPetSubTab("list")} style={{background: petSubTab === "list" ? "#2196F3" : "none", color: petSubTab === "list" ? "white" : "#666", padding: "10px 20px", borderRadius: "20px", border: petSubTab === "list" ? "none" : "1px solid #ddd", cursor: "pointer", fontWeight: "bold"}}>🐾 My Pets</button>
                        <button onClick={() => setPetSubTab("records")} style={{background: petSubTab === "records" ? "#2196F3" : "none", color: petSubTab === "records" ? "white" : "#666", padding: "10px 20px", borderRadius: "20px", border: petSubTab === "records" ? "none" : "1px solid #ddd", cursor: "pointer", fontWeight: "bold"}}>💉 Medical Records</button>
                    </div>

                    {/* VIEW 1: PET LIST */}
                    {petSubTab === "list" && (
                        <>
                            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px"}}>
                                <input type="text" placeholder="🔍 Search your pets..." value={petSearch} onChange={(e) => setPetSearch(e.target.value)} style={{ borderRadius: "8px", padding: "12px", border: "1px solid #ddd", width: "60%" }} />
                                <button onClick={openAddPetModal} style={{background:"#4CAF50", color:"white", border:"none", borderRadius:"8px", padding:"10px 20px", cursor:"pointer", fontWeight: "bold", display:"flex", alignItems:"center", gap:"5px"}}>+ Add Pet</button>
                            </div>
                            <div style={{ flex: 1, overflowY: "auto" }}>
                                {filteredPets.length === 0 ? <p style={{color:"#888", textAlign:"center", padding:"30px"}}>No pets found.</p> : (
                                    <table style={{width: "100%", borderCollapse: "collapse"}}>
                                        <thead>
                                            <tr style={{textAlign: "left", borderBottom: "2px solid #eee", color: "#666"}}>
                                                <th style={{padding: "12px"}}>Name</th>
                                                <th style={{padding: "12px"}}>Info</th>
                                                <th style={{padding: "12px"}}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredPets.map(pet => (
                                                <tr key={pet.id} style={{borderBottom: "1px solid #f9f9f9", background: pet.deletionStatus === 'Pending' ? '#ffebee' : 'transparent'}}>
                                                    <td style={{padding: "15px", fontWeight: "bold", fontSize: "16px"}}>
                                                        <span style={{marginRight:"10px", fontSize:"20px"}}>{['Dog','Cat'].includes(pet.species) ? (pet.species==='Dog'?'🐕':'🐈') : '🐾'}</span>
                                                        {pet.name}
                                                    </td>
                                                    <td style={{padding: "15px", color: "#555"}}>
                                                        <div>{pet.species} - {pet.breed}</div>
                                                        <div style={{fontSize: "12px"}}>{pet.age} {pet.ageUnit} ({pet.gender})</div>
                                                    </td>
                                                    <td style={{padding: "15px"}}>
                                                        {pet.deletionStatus === 'Pending' ? (
                                                             <span style={{color: "red", fontWeight: "bold", fontSize: "12px", padding: "4px 8px", background: "#ffebee", borderRadius: "4px"}}>Deletion Pending</span>
                                                        ) : (
                                                            <div style={{display: "flex", gap: "8px"}}>
                                                                <button onClick={() => handleViewPetHistory(pet.id)} style={{padding: "6px 12px", background: "#E3F2FD", color: "#1976D2", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "10px"}}>Records</button>
                                                                <button onClick={() => setRequestEditPet(pet)} style={{padding: "6px 12px", background: "#ff9800", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "10px"}} > Request Edit </button>
                                                                <button onClick={() => openDeleteModal(pet.id, pet.name)} style={{padding: "6px 12px", background: "none", color: "#f44336", border: "1px solid #f44336", borderRadius: "4px", cursor: "pointer", fontSize: "10px"}}>Delete</button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </>
                    )}

                    {/* VIEW 2: MEDICAL RECORDS */}
                    {petSubTab === "records" && (
                        <div style={{flex: 1, display: "flex", flexDirection: "column", overflow: "hidden"}}>
                            <div style={{marginBottom: "20px", display: "flex", gap: "15px", alignItems: "center"}}>
                                <label style={{fontWeight: "bold", color: "#555"}}>Filter by Pet:</label>
                                <select value={recordFilterPetId} onChange={(e) => setRecordFilterPetId(e.target.value)} style={{padding: "10px", borderRadius: "6px", border: "1px solid #ddd", minWidth: "200px"}}>
                                    <option value="all">All Pets</option>
                                    {myPets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}

                                </select>
                            </div>

                            <div style={{flex: 1, overflowY: "auto", border: "1px solid #eee", borderRadius: "8px", background: "#fdfdfd"}}>
                                {medicalRecords.length === 0 ? (
                                    <div style={{textAlign: "center", padding: "40px", color: "#999"}}>
                                        <div style={{fontSize: "40px", marginBottom: "10px"}}>📂</div>
                                        <p>No medical records found.</p>
                                        <small>Only completed appointments appear here.</small>
                                    </div>
                                ) : (
                                    medicalRecords.map(record => (
                                        <div key={record.id} style={{display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px", borderBottom: "1px solid #eee", background: "white"}}>
                                            <div>
                                                <div style={{fontWeight: "bold", fontSize: "15px", color: "#2196F3"}}>{record.date}</div>
                                                <div style={{fontSize: "14px", fontWeight: "bold", marginTop: "2px"}}>{record.petName}</div>
                                                <div style={{fontSize: "13px", color: "#666", marginTop: "4px"}}>Diagnosis: {record.diagnosis || "N/A"}</div>
                                            </div>
                                            <button onClick={() => handleViewMedicalRecord(record)} style={{padding: "8px 15px", background: "#e3f2fd", color: "#1976D2", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px"}}>View Details</button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                </div>
            )}

            {/* --- APPOINTMENTS TAB --- */}
            {activeTab === "appointments" && (
                <div style={{ height: "100%", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                    {/* MOBILE TOGGLE BUTTONS */}
                    {isMobile && (
                        <div style={{display: "flex", marginBottom: "15px", background: "white", padding: "5px", borderRadius: "12px", boxShadow: "0 2px 5px rgba(0,0,0,0.05)", flexShrink: 0}}>
                            <button onClick={() => setApptSubTab("request")} style={{ flex: 1, padding: "10px", border: "none", borderRadius: "8px", fontWeight: "600", cursor: "pointer", transition: "all 0.2s", background: apptSubTab === "request" ? "#2196F3" : "transparent", color: apptSubTab === "request" ? "white" : "#666" }}>➕ Request</button>
                            <button onClick={() => setApptSubTab("list")} style={{ flex: 1, padding: "10px", border: "none", borderRadius: "8px", fontWeight: "600", cursor: "pointer", transition: "all 0.2s", background: apptSubTab === "list" ? "#2196F3" : "transparent", color: apptSubTab === "list" ? "white" : "#666" }}>📋 List</button>
                        </div>
                    )}

                    <div style={{ display: isMobile ? "block" : "grid", gridTemplateColumns: isMobile ? "1fr" : "350px 1fr", gap: "20px", height: "100%", overflow: "hidden" }}>
                        
                        {/* LEFT SIDE: Request Form */}
                        {(!isMobile || apptSubTab === "request") && (
                            <div className="card" style={{ display: "flex", flexDirection: "column", height: "100%", overflowY: "auto", padding: "20px", boxSizing: "border-box" }}>
                                <h3 style={{marginTop:0, color: "#2196F3", borderBottom: "1px solid #eee", paddingBottom: "10px"}}>Request Appointment</h3>
                                
                                <div style={{background: "#e3f2fd", padding: "10px", borderRadius: "8px", fontSize: "13px", color: "#0d47a1", marginBottom: "15px", borderLeft: "4px solid #2196F3"}}>
                                    <strong>ℹ️ Note:</strong> The clinic is closed on <strong>Saturdays</strong>. Consultations typically last <strong>30 mins - 1 hr</strong>.
                                </div>

                                <form onSubmit={handleBookAppointment} style={{display: "flex", flexDirection: "column", gap: "15px"}}>
                                    <div>
                                        <label style={{fontSize: "13px", fontWeight: "bold", color: "#555"}}>Select Pet</label>
                                        <select value={selectedPetId} onChange={(e) => setSelectedPetId(e.target.value)} required style={{width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #ddd", marginTop: "5px"}}>
                                            <option value="">-- Choose Pet --</option>
                                            {myPets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{fontSize: "13px", fontWeight: "bold", color: "#555"}}>Preferred Date</label>
                                        <input type="date" value={apptDate} onChange={(e) => setApptDate(e.target.value)} required style={{width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #ddd", marginTop: "5px"}} />
                                    </div>
                                    <div>
                                        <label style={{fontSize: "13px", fontWeight: "bold", color: "#555"}}>Preferred Time</label>
                                        <input type="time" value={apptTime} onChange={(e) => setApptTime(e.target.value)} required style={{width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #ddd", marginTop: "5px"}} />
                                    </div>
                                    <button type="submit" style={{marginTop: "10px", padding: "15px", background: "#2196F3", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer"}}>
                                        {isSaving ? "Booking..." : "Submit Request"}
                                    </button>
                                </form>
                            </div>
                        )}

                        {/* RIGHT SIDE: List */}
                        {(!isMobile || apptSubTab === "list") && (
                            <div className="card" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", padding: "20px", boxSizing: "border-box" }}>
                                <div style={{display: "flex", gap: "10px", marginBottom: "15px", overflowX: "auto", paddingBottom: "5px", borderBottom: "1px solid #eee"}}>
                                    {["Approved", "Pending", "Cancelled"].map(filter => (
                                        <button key={filter} onClick={() => setApptFilter(filter)} style={{padding: "8px 16px", borderRadius: "20px", border: "none", cursor: "pointer", background: apptFilter === filter ? "#2196F3" : "#f1f1f1", color: apptFilter === filter ? "white" : "#555", fontWeight: "bold", fontSize: "13px", whiteSpace: "nowrap"}}>
                                            {filter}
                                        </button>
                                    ))}
                                </div>
                                <div style={{flex: 1, overflowY: "auto"}}>
                                    {filteredAppointments.length === 0 ? <p style={{color: "#888", textAlign: "center", marginTop: "40px"}}>No {apptFilter.toLowerCase()} appointments.</p> : (
                                        <div style={{display: "flex", flexDirection: "column", gap: "10px"}}>
                                            {filteredAppointments.map(appt => (
                                                <div key={appt.id} style={{border: "1px solid #eee", borderRadius: "8px", padding: "15px", background: "white", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 2px 4px rgba(0,0,0,0.02)"}}>
                                                    <div>
                                                        <div style={{fontWeight: "bold", fontSize: "16px", color: "#333"}}>{appt.petName}</div>
                                                        <div style={{fontSize: "14px", color: "#666", margin: "4px 0"}}>📅 {appt.date} at {appt.time}</div>
                                                        <div style={{fontSize: "13px", color: "#888"}}>{appt.reason}</div>
                                                        <span style={{fontSize: "11px", background: getStatusColor(appt.status), color: "white", padding: "2px 8px", borderRadius: "4px", marginTop: "5px", display: "inline-block"}}>{appt.status}</span>
                                                        
                                                        {appt.status === "Cancelled" && appt.cancellationReason && (
                                                            <div style={{fontSize:"12px", color: "#d32f2f", marginTop: "5px", background: "#ffebee", padding: "5px", borderRadius: "4px"}}>
                                                                <strong>Reason:</strong> {appt.cancellationReason}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div style={{display: "flex", flexDirection: "column", gap: "5px"}}>
                                                        {appt.status === "Pending" && (
                                                            <>
                                                                <button onClick={() => openRescheduleModal(appt)} style={{padding: "6px 12px", fontSize: "12px", background: "#FF9800", color: "white", border: "none", borderRadius: "4px", cursor: "pointer"}}>Reschedule</button>
                                                                <button onClick={() => openCancelModal(appt.id)} style={{padding: "6px 12px", fontSize: "12px", background: "#f44336", color: "white", border: "none", borderRadius: "4px", cursor: "pointer"}}>Cancel</button>
                                                            </>
                                                        )}
                                                        {appt.status === "Approved" && (
                                                            <button onClick={() => openCancelModal(appt.id)} style={{padding: "6px 12px", fontSize: "12px", background: "#f44336", color: "white", border: "none", borderRadius: "4px", cursor: "pointer"}}>Cancel</button>
                                                        )}
                                                        {appt.status === "Done" && (
                                                            <button onClick={() => handleViewMedicalRecord(appt)} style={{padding: "6px 12px", fontSize: "12px", background: "#2196F3", color: "white", border: "none", borderRadius: "4px", cursor: "pointer"}}>View Record</button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* --- MESSAGES TAB --- */}
            {activeTab === "chat" && (
                <div className="card" style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: "0", overflow: "hidden" }}>
                    <div style={{padding: "15px", background: "#f9f9f9", borderBottom: "1px solid #ddd", fontWeight: "bold", display: "flex", alignItems: "center", gap: "10px"}}>
                        <span>💬</span> Chat with Clinic Staff
                    </div>
                    <div style={{flex: 1, padding: "20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "15px", background: "white"}}>
                        {chatMessages.length === 0 && <div style={{textAlign: "center", color: "#ccc", marginTop: "50px"}}>No messages yet. Start conversation below!</div>}
                        {chatMessages.map(msg => (
                            <div key={msg.id} style={{alignSelf: msg.senderId === user.uid ? "flex-end" : "flex-start", maxWidth: "70%", display: "flex", flexDirection: "column", alignItems: msg.senderId === user.uid ? "flex-end" : "flex-start"}}>
                                <div style={{
                                    background: msg.senderId === user.uid ? "#2196F3" : "#f1f1f1", 
                                    color: msg.senderId === user.uid ? "white" : "#333", 
                                    padding: "10px 15px", 
                                    borderRadius: "18px", 
                                    borderBottomRightRadius: msg.senderId === user.uid ? "4px" : "18px", 
                                    borderBottomLeftRadius: msg.senderId !== user.uid ? "4px" : "18px",
                                    fontSize: "14px",
                                    boxShadow: "0 1px 2px rgba(0,0,0,0.1)"
                                }}>
                                    {msg.text}
                                </div>
                                <div style={{fontSize: "10px", color: "#999", marginTop: "3px", marginRight: "5px"}}>
                                    {msg.createdAt 
                                    ? (msg.createdAt.toDate ? msg.createdAt.toDate() : new Date(msg.createdAt)).toLocaleString([], {year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'})
                                    : "Just now"}
                                    {msg.senderId === user.uid && <span onClick={() => handleStartEdit(msg)} style={{marginLeft: "10px", cursor: "pointer", color: "#2196F3"}}>Edit</span>}
                                </div>
                            </div>
                        ))}
                        <div ref={scrollRef} />
                    </div>
                    <form onSubmit={handleSendMessage} style={{padding: "15px", borderTop: "1px solid #eee", background: "white", display: "flex", gap: "10px"}}>
                        <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Type your message..." style={{flex: 1, padding: "12px", borderRadius: "25px", border: "1px solid #ddd", fontSize: "14px", outline: "none"}} />
                        {editingMessageId && <button type="button" onClick={handleCancelEdit} style={{background: "#999", color: "white", border: "none", padding: "0 20px", borderRadius: "25px", cursor: "pointer"}}>Cancel</button>}
                        <button type="submit" disabled={isSaving} style={{background: isSaving ? "#ccc" : "#2196F3", color: "white", border: "none", padding: "0 25px", borderRadius: "25px", fontWeight: "bold", cursor: isSaving ? "not-allowed" : "pointer"}}>
                            {isSaving ? "Sending..." : "Send"}
                        </button>
                    </form>
                </div>
            )}

        </div>
      </main>

      {/* --- MODALS (Reusing styled overlays) --- */}
      
      {/* 1. Add/Edit Pet Modal - COMPACT LAYOUT */}
      {showPetModal && (
          <div className="modal-overlay" style={{position:"fixed", top:0, left:0, width:"100%", height:"100%", background:"rgba(0,0,0,0.5)", display:"flex", justifyContent:"center", alignItems:"center", zIndex:2000}}>
              <div style={{background:"white", padding:"25px", borderRadius:"12px", width:"450px", maxWidth:"90%", maxHeight:"90vh", overflowY:"auto", boxShadow: "0 10px 30px rgba(0,0,0,0.3)"}}>
                  <h3 style={{marginTop:0, color: "#333", borderBottom: "1px solid #f0f0f0", paddingBottom: "10px", marginBottom: "20px"}}>{isEditingPet ? "Edit Pet Details" : "Add New Pet"}</h3>
                  <form onSubmit={handlePetSubmit} style={{display:"flex", flexDirection:"column", gap:"10px"}}>
                      
                      {/* Name - Full Width */}
                      <div>
                          <label style={labelStyle}>Pet's Name</label>
                          <input type="text" placeholder="e.g. Buster" required value={petName} onChange={(e) => setPetName(e.target.value)} style={inputStyle} />
                      </div>
                      
                      {/* Species - Full Width */}
                      <div>
                          <label style={labelStyle}>Species</label>
                          <select value={species} onChange={(e) => setSpecies(e.target.value)} style={selectStyle}>
                              <option value="Dog">Dog</option>
                              <option value="Cat">Cat</option>
                              <option value="Other">Other</option>
                          </select>
                      </div>

                      {/* Breed - Full Width (Appears Below Species) */}
                      <div>
                          <label style={labelStyle}>Breed</label>
                           {/* Breed Logic: Dropdown if Dog/Cat, else Text Input */}
                          {["Dog", "Cat"].includes(species) ? (
                              <select value={breed} onChange={(e) => setBreed(e.target.value)} style={selectStyle}>
                                  <option value="">-- Select --</option>
                                  {(species === "Dog" ? DOG_BREEDS : CAT_BREEDS).map(b => <option key={b} value={b}>{b}</option>)}
                              </select>
                          ) : (
                              <input type="text" placeholder="Optional" value={breed} onChange={(e) => setBreed(e.target.value)} style={inputStyle} />
                          )}
                      </div>

                      {/* Conditional: If "Other" species or "Other" breed selected, show text box */}
                      {(species === "Other" || (breed === "Other" && ["Dog", "Cat"].includes(species))) && (
                          <div>
                              <label style={labelStyle}>Specify {species === "Other" ? "Species" : "Breed"}</label>
                              <input type="text" placeholder={species === "Other" ? "e.g. Turtle" : "e.g. Labradoodle"} value={species === "Other" ? otherSpecies : otherBreed} onChange={(e) => species === "Other" ? setOtherSpecies(e.target.value) : setOtherBreed(e.target.value)} style={inputStyle} />
                          </div>
                      )}

                      {/* Row: Gender & Age (Side-by-Side to save vertical space) */}
                      <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px"}}>
                          {/* Gender */}
                          <div>
                            <label style={labelStyle}>Gender</label>
                            <select value={gender} onChange={(e) => setGender(e.target.value)} style={selectStyle}>
                                <option value="Male">♂ Male</option>
                                <option value="Female">♀ Female</option>
                                <option value="Unknown">Unknown</option>
                            </select>
                          </div>

                          {/* Age */}
                          <div>
                             <label style={labelStyle}>Age</label>
                             <div style={{display: "flex", gap: "5px"}}>
                                <input type="number" placeholder="0" required value={age} onChange={(e) => setAge(e.target.value)} style={{...inputStyle, flex: "1"}} min="0" />
                                <select value={ageUnit} onChange={(e) => setAgeUnit(e.target.value)} style={{...selectStyle, width: "auto", flex: "1.5", paddingRight: "25px", minWidth: "80px"}}>
                                    <option value="Years">Yrs</option>
                                    <option value="Months">Mos</option>
                                </select>
                             </div>
                          </div>
                      </div>

                      {/* Medical History - Full Width */}
                      <div>
                        <label style={labelStyle}>Medical History (Optional)</label>
                        <textarea placeholder="Allergies, past surgeries, etc." value={medicalHistory} onChange={(e) => setMedicalHistory(e.target.value)} style={{...inputStyle, resize: "vertical"}} rows="3" />
                      </div>
                      
                      {/* Action Buttons */}
                      <div style={{display:"flex", gap:"10px", marginTop:"10px", borderTop: "1px solid #f0f0f0", paddingTop: "15px"}}>
                          <button type="button" onClick={() => setShowPetModal(false)} style={{flex:1, background:"#f5f5f5", color:"#555", border:"none", padding:"12px", borderRadius:"6px", cursor:"pointer", fontWeight: "bold"}}>Cancel</button>
                          <button type="submit" style={{flex:1, background:"#2196F3", color:"white", border:"none", padding:"12px", borderRadius:"6px", cursor:"pointer", fontWeight: "bold"}}>Save Pet</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* 2. Cancel Modal */}
      {showCancelModal && (
          <div className="modal-overlay" style={{position:"fixed", top:0, left:0, width:"100%", height:"100%", background:"rgba(0,0,0,0.5)", display:"flex", justifyContent:"center", alignItems:"center", zIndex:2000}}>
              <div style={{background:"white", padding:"25px", borderRadius:"12px", width:"350px"}}>
                  <h3 style={{marginTop:0}}>Cancel Appointment</h3>
                  <textarea placeholder="Reason for cancellation..." value={cancelData.reason} onChange={(e) => setCancelData({...cancelData, reason: e.target.value})} style={{width:"100%", padding:"10px", borderRadius:"6px", border:"1px solid #ddd", marginBottom:"15px", boxSizing:"border-box"}} rows="3" />
                  <div style={{display:"flex", gap:"10px"}}>
                      <button onClick={handleConfirmCancel} style={{flex:1, background:"#f44336", color:"white", border:"none", padding:"10px", borderRadius:"6px", cursor:"pointer"}}>Confirm Cancel</button>
                      <button onClick={() => setShowCancelModal(false)} style={{flex:1, background:"#ccc", border:"none", padding:"10px", borderRadius:"6px", cursor:"pointer"}}>Back</button>
                  </div>
              </div>
          </div>
      )}

       {/* 3. Delete Modal */}
      {showDeleteModal && (
          <div className="modal-overlay" style={{position:"fixed", top:0, left:0, width:"100%", height:"100%", background:"rgba(0,0,0,0.5)", display:"flex", justifyContent:"center", alignItems:"center", zIndex:2000}}>
              <div style={{background:"white", padding:"25px", borderRadius:"12px", width:"350px"}}>
                  <h3 style={{marginTop:0}}>Delete {deleteData.name}?</h3>
                  <p style={{fontSize:"13px", color:"#666"}}>To prevent accidental data loss, deletions must be approved by an Admin.</p>
                  <textarea placeholder="Reason for deletion..." value={deleteData.reason} onChange={(e) => setDeleteData({...deleteData, reason: e.target.value})} style={{width:"100%", padding:"10px", borderRadius:"6px", border:"1px solid #ddd", marginBottom:"15px", boxSizing:"border-box"}} rows="3" />
                  <div style={{display:"flex", gap:"10px"}}>
                      <button onClick={handleConfirmDelete} style={{flex:1, background:"#f44336", color:"white", border:"none", padding:"10px", borderRadius:"6px", cursor:"pointer"}}>Request Delete</button>
                      <button onClick={() => setShowDeleteModal(false)} style={{flex:1, background:"#ccc", border:"none", padding:"10px", borderRadius:"6px", cursor:"pointer"}}>Back</button>
                  </div>
              </div>
          </div>
      )}
      
      {/* 4. Reschedule Modal */}
      {showRescheduleModal && (
          <div className="modal-overlay" style={{position:"fixed", top:0, left:0, width:"100%", height:"100%", background:"rgba(0,0,0,0.5)", display:"flex", justifyContent:"center", alignItems:"center", zIndex:2000}}>
              <div style={{background:"white", padding:"25px", borderRadius:"12px", width:"350px"}}>
                  <h3 style={{marginTop:0}}>Reschedule Appointment</h3>
                  <form onSubmit={handleRescheduleSubmit}>
                      <label style={{display:"block", marginBottom:"5px", fontWeight:"bold", fontSize:"13px"}}>New Date:</label>
                      <input type="date" required value={rescheduleData.date} onChange={(e) => setRescheduleData({...rescheduleData, date: e.target.value})} style={{width:"100%", padding:"10px", borderRadius:"6px", border:"1px solid #ddd", marginBottom:"15px", boxSizing:"border-box"}} />
                      
                      <label style={{display:"block", marginBottom:"5px", fontWeight:"bold", fontSize:"13px"}}>New Time:</label>
                      <input type="time" required value={rescheduleData.time} onChange={(e) => setRescheduleData({...rescheduleData, time: e.target.value})} style={{width:"100%", padding:"10px", borderRadius:"6px", border:"1px solid #ddd", marginBottom:"15px", boxSizing:"border-box"}} />
                      
                      <div style={{display:"flex", gap:"10px"}}>
                          <button type="submit" style={{flex:1, background:"#FF9800", color:"white", border:"none", padding:"10px", borderRadius:"6px", cursor:"pointer"}}>Reschedule</button>
                          <button type="button" onClick={() => setShowRescheduleModal(false)} style={{flex:1, background:"#ccc", border:"none", padding:"10px", borderRadius:"6px", cursor:"pointer"}}>Cancel</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* 5. Medical Record Modal (VIEW ONLY) */}
      {showMedicalModal && selectedRecord && (
          <div className="modal-overlay" style={{position:"fixed", top:0, left:0, width:"100%", height:"100%", background:"rgba(0,0,0,0.5)", display:"flex", justifyContent:"center", alignItems:"center", zIndex:2000}}>
              <div style={{background:"white", padding:"30px", borderRadius:"12px", width:"500px", maxWidth:"90%", maxHeight:"80vh", overflowY:"auto"}}>
                  <div style={{textAlign:"center", borderBottom:"1px solid #eee", paddingBottom:"15px", marginBottom:"20px"}}>
                      <h2 style={{margin:0, color: "#2196F3"}}>Medical Record</h2>
                      <div style={{fontSize:"14px", color:"#666"}}>{selectedRecord.date}</div>
                  </div>
                  <div style={{marginBottom:"15px"}}>
                      <strong>Diagnosis:</strong>
                      <div style={{background:"#e3f2fd", color:"#1565C0", padding:"10px", borderRadius:"6px", marginTop:"5px"}}>{selectedRecord.diagnosis || "N/A"}</div>
                  </div>
                  <div style={{marginBottom:"15px"}}>
                      <strong>Treatment / Medicine:</strong>
                      <div style={{background:"#f5f5f5", padding:"10px", borderRadius:"6px", marginTop:"5px"}}>{selectedRecord.medicine || "N/A"}</div>
                  </div>
                  <div style={{marginBottom:"20px"}}>
                      <strong>Vet Notes:</strong>
                      <p style={{margin:"5px 0", fontSize:"14px", color:"#555"}}>{selectedRecord.notes || "None"}</p>
                  </div>
                  <div style={{display:"flex", gap:"10px"}}>
                      <button onClick={() => handlePrintRecord(selectedRecord)} style={{flex:1, background:"#607D8B", color:"white", border:"none", padding:"10px", borderRadius:"6px", cursor:"pointer"}}>🖨 Print</button>
                      <button onClick={() => setShowMedicalModal(false)} style={{flex:1, background:"#ccc", border:"none", padding:"10px", borderRadius:"6px", cursor:"pointer"}}>Close</button>
                  </div>
              </div>
          </div>
      )}
      {requestEditPet && (  <EditPetModal pet={requestEditPet} onClose={() => setRequestEditPet(null)} />)}

      {/* 7. Logout Confirm Modal */}
      {confirmModal.show && (
          <div className="modal-overlay" style={{position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 3000}}>
              <div style={{ background: "white", padding: "25px", borderRadius: "12px", width: "350px", textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
                  <h3 style={{margin: "0 0 15px 0", color: "#333"}}>Confirmation</h3>
                  <p style={{marginBottom: "25px", fontSize: "16px", color: "#666"}}>{confirmModal.message}</p>
                  <div style={{display: "flex", justifyContent: "center", gap: "15px"}}>
                      <button onClick={() => setConfirmModal({ ...confirmModal, show: false })} style={{ padding: "10px 20px", background: "#e0e0e0", color: "#333", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>Cancel</button>
                      <button onClick={() => { confirmModal.onConfirm(); setConfirmModal({ ...confirmModal, show: false }); }} style={{ padding: "10px 20px", background: "#f44336", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>Yes</button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default OwnerDashboard;
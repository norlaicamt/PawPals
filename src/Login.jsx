// src/Login.jsx
import { useState } from "react";
import { auth, db } from "./firebase";
import { signInWithEmailAndPassword, signOut } from "firebase/auth"; 
import { doc, getDoc, collection, addDoc } from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";
import logoImg from "./assets/logo.png";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(""); 
  
  // Custom Alert State (Replaces window.alert)
  const [alertMsg, setAlertMsg] = useState({ show: false, message: "", type: "" });

  // Reactivation Modal State
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [reactivateEmail, setReactivateEmail] = useState("");
  const [reactivateReason, setReactivateReason] = useState("");
  const [reactivateLoading, setReactivateLoading] = useState(false);

  const navigate = useNavigate();

  const showAlert = (message, type = "error") => {
      setAlertMsg({ show: true, message, type });
      setTimeout(() => setAlertMsg({ show: false, message: "", type: "" }), 3000);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(""); 

    const localPart = email.split('@')[0];
    if (/^\d+$/.test(localPart)) {
        setError("Invalid email format (cannot be purely numeric).");
        setLoading(false);
        return;
    }

    if (password === email) {
        setError("Invalid credentials: Password cannot match email.");
        setLoading(false);
        return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const userData = docSnap.data();
        const role = userData.role; 

        if (userData.isDisabled === true) {
            await signOut(auth); 
            throw new Error("ACCOUNT_DISABLED");
        }

        if (role === "owner" && !user.emailVerified) {
             await signOut(auth); 
             throw new Error("Email not verified. Please check your inbox.");
        }

        switch (role) {
            case "owner": navigate("/owner-dashboard"); break;
            case "staff": navigate("/staff-dashboard"); break;
            case "admin": navigate("/admin-dashboard"); break;
            default:
                await signOut(auth);
                throw new Error("Account has no assigned role.");
        }
      } else {
        await signOut(auth);
        throw new Error("Email address not found.");
      }
    } catch (err) {
      console.error(err);
      let message = err.message;
      if (err.code === 'auth/invalid-credential') message = "Incorrect email or password.";
      else if (err.code === 'auth/user-not-found') message = "Account not found.";
      else if (message === "ACCOUNT_DISABLED") message = "Your account has been disabled.";
      else if (message.includes("Email not verified")) message = "Please verify your email address before logging in.";
      
      setError(message);
    }
    setLoading(false);
  };

  const handleReactivateRequest = async () => {
      if(!reactivateEmail || !reactivateReason) {
          showAlert("Please fill in all fields.");
          return;
      }
      setReactivateLoading(true);
      try {
          await addDoc(collection(db, "reactivation_requests"), {
              email: reactivateEmail,
              reason: reactivateReason,
              timestamp: new Date()
          });
          showAlert("Request sent! You will be notified via email.", "success");
          setTimeout(() => setShowReactivateModal(false), 2000);
          setReactivateReason("");
      } catch (err) {
          console.error(err);
          showAlert("Failed to send request. Please try again.");
      }
      setReactivateLoading(false);
  };

  return (
    <div className="auth-container">
      {/* CUSTOM ALERT BOX */}
      {alertMsg.show && (
        <div style={{
            position: "fixed", top: "20px", left: "50%", transform: "translateX(-50%)",
            background: alertMsg.type === "success" ? "#4CAF50" : "#333", color: "white",
            padding: "10px 20px", borderRadius: "8px", zIndex: 3000, boxShadow: "0 4px 10px rgba(0,0,0,0.2)"
        }}>
            {alertMsg.message}
        </div>
      )}

      <div className="auth-card" style={{ position: "relative" }}>
        
        <button 
          onClick={() => navigate("/")} 
          style={{
            position: "absolute", top: "15px", left: "15px", background: "none", border: "none",
            cursor: "pointer", color: "#666", display: "flex", alignItems: "center", fontSize: "14px", fontWeight: "bold"
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: "5px"}}><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          Back
        </button>

        <div className="auth-header" style={{ marginTop: "20px" }}>
          <img src={logoImg} alt="PawPals Logo" className="auth-logo-img" />
          <h2 style={{margin:0, color:"#333"}}>Welcome Back</h2>
          <p style={{margin:"5px 0 0", color:"#666"}}>PawPals Management System</p>
        </div>
        
        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <input 
            type="email" placeholder="Email Address" onChange={(e) => setEmail(e.target.value)} required 
            className="auth-input" 
          />
          
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <input 
              type={showPassword ? "text" : "password"} placeholder="Password" onChange={(e) => setPassword(e.target.value)} required 
              className="auth-input" style={{ width: "100%", paddingRight: "40px" }}
            />
            <button
              type="button" onClick={() => setShowPassword(!showPassword)}
              style={{
                position: "absolute", right: "10px", background: "none", border: "none", cursor: "pointer", color: "#666", padding: "0", display: "flex", alignItems: "center"
              }}
            >
              {showPassword ? "👁️" : "👁️‍🗨️"}
            </button>
          </div>
          
          {error && (
            <div style={{ color: "#d32f2f", background: "#ffebee", padding: "10px", borderRadius: "4px", fontSize: "14px", textAlign: "center", display: "flex", flexDirection: "column", gap: "5px" }}>
                <span>{error}</span>
                {error.includes("disabled") && (
                    <button type="button" onClick={() => { setReactivateEmail(email); setShowReactivateModal(true); }}
                        style={{ background: "transparent", border: "none", color: "#d32f2f", textDecoration: "underline", cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}
                    >
                        Request Reactivation
                    </button>
                )}
            </div>
          )}

          <button type="submit" className="action-btn" style={{ background: "#1565C0", color: "white", width: "100%", padding: "12px", marginTop: "10px" }} disabled={loading}>
            {loading ? "Verifying..." : "Login"}
          </button>
        </form>
        
        <Link to="/signup" className="auth-link">New Pet Owner? Register here</Link>
      </div>

      {/* REACTIVATION REQUEST MODAL */}
      {showReactivateModal && (
          <div style={{
              position: "fixed", top: 0, left: 0, width: "100%", height: "100%", 
              background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000
          }}>
              <div style={{ background: "white", padding: "25px", borderRadius: "12px", width: "350px", textAlign: "center" }}>
                  <h3 style={{margin: "0 0 15px 0"}}>Reactivate Account</h3>
                  <p style={{fontSize: "14px", color: "#666", marginBottom: "15px"}}>
                      Please provide a reason why your account should be reactivated.
                  </p>
                  <input type="email" value={reactivateEmail} readOnly style={{width: "100%", padding: "10px", marginBottom: "10px", borderRadius: "6px", border: "1px solid #ddd", background: "#f5f5f5", boxSizing: "border-box"}} />
                  <textarea 
                      placeholder="Reason for reactivation..." value={reactivateReason} onChange={(e) => setReactivateReason(e.target.value)}
                      style={{width: "100%", height: "80px", padding: "10px", borderRadius: "6px", border: "1px solid #ddd", marginBottom: "15px", boxSizing: "border-box", fontFamily: "inherit"}}
                  />
                  <div style={{display: "flex", gap: "10px"}}>
                      <button onClick={() => setShowReactivateModal(false)} style={{flex: 1, padding: "10px", background: "#eee", border: "none", borderRadius: "6px", cursor: "pointer"}}>Cancel</button>
                      <button onClick={handleReactivateRequest} disabled={reactivateLoading} style={{flex: 1, padding: "10px", background: "#2196F3", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold"}}>
                          {reactivateLoading ? "Sending..." : "Submit"}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Login;
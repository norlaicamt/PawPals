// src/Signup.jsx
import { useState } from "react";
import { auth, db } from "./firebase";
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";
import logoImg from "./assets/logo.png";

// Helper component for checklist
const RequirementItem = ({ fulfilled, text }) => (
  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: fulfilled ? "#2e7d32" : "#666", marginBottom: "2px" }}>
    {fulfilled ? (
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
    ) : (
      <div style={{ width: "10px", height: "10px", borderRadius: "50%", border: "1px solid #ccc" }}></div>
    )}
    <span>{text}</span>
  </div>
);

const Signup = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fname, setFname] = useState("");
  const [lname, setLname] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(""); 
  
  // 1. New State for the Success Modal
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  
  const navigate = useNavigate();

  const passwordValidations = {
    hasLower: /[a-z]/.test(password),
    hasUpper: /[A-Z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSymbol: /[\W_]/.test(password), 
    hasLength: password.length >= 8,
  };

  const validateInputs = () => {
    if (email) {
      const localPart = email.split('@')[0];
      if (/^\d+$/.test(localPart)) return "Email address cannot consist only of numbers.";
    }
    if (password === email) return "Password cannot be the same as your email address.";
    if (password !== confirmPassword) return "Passwords do not match.";

    const { hasLower, hasUpper, hasNumber, hasSymbol, hasLength } = passwordValidations;
    if (!hasLower || !hasUpper || !hasNumber || !hasSymbol || !hasLength) {
      return "Please fulfill all password requirements.";
    }
    return null;
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError(""); 
    
    const validationError = validateInputs();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      await setDoc(doc(db, "users", user.uid), {
        firstName: fname, lastName: lname, email: email, role: "owner", createdAt: new Date()
      });

      await sendEmailVerification(user);

      // 2. CHANGED: Replaced alert() and immediate navigation with the Modal
      setShowSuccessModal(true);

    } catch (error) {
      console.error(error);
      const message = error.code === "auth/email-already-in-use" 
        ? "This email is already in use." 
        : "Signup Failed: " + error.message;
      setError(message);
    }
    setLoading(false);
  };

  const isMismatch = confirmPassword && password !== confirmPassword;

  return (
    <div className="auth-container">
      
      {/* 3. NEW: Custom Success Modal Overlay */}
      {showSuccessModal && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, width: "100%", height: "100%",
          backgroundColor: "rgba(0,0,0,0.6)", // Dark transparent background
          display: "flex", justifyContent: "center", alignItems: "center",
          zIndex: 9999
        }}>
          <div style={{
            backgroundColor: "white", padding: "30px", borderRadius: "12px",
            textAlign: "center", maxWidth: "400px", width: "90%",
            boxShadow: "0 5px 15px rgba(0,0,0,0.3)"
          }}>
             {/* Success Icon */}
            <div style={{ margin: "0 auto 15px", width: "50px", height: "50px", borderRadius: "50%", background: "#e8f5e9", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#255bb7ff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
            
            <h3 style={{ margin: "0 0 10px", color: "#333" }}>Account Created!</h3>
            <p style={{ color: "#666", marginBottom: "25px", lineHeight: "1.5" }}>
              Your account has been successfully created. Please check your email to verify your account before logging in.
            </p>
            
            <button 
              onClick={() => navigate("/login")}
              style={{
                background: "#255bb7ff", color: "white", border: "none",
                padding: "12px 25px", borderRadius: "6px", cursor: "pointer",
                fontWeight: "bold", fontSize: "14px", width: "100%"
              }}
            >
              Continue to Login
            </button>
          </div>
        </div>
      )}

      {/* Main Auth Card (Existing Code) */}
      <div className="auth-card" style={{maxWidth: "600px", position: "relative", padding: "30px"}}>
        
        <button 
          onClick={() => navigate("/")} 
          style={{ position: "absolute", top: "20px", left: "20px", background: "none", border: "none", cursor: "pointer", color: "#666", display: "flex", alignItems: "center", fontSize: "14px", fontWeight: "bold" }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: "5px"}}><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          Back
        </button>

        <div className="auth-header" style={{marginTop: "25px", marginBottom: "20px"}}>
          <img src={logoImg} alt="PawPals Logo" className="auth-logo-img" style={{marginBottom: "5px"}} />
          <h1 style={{margin:0, color:"#333", fontSize: "2rem"}}>PawPals</h1>
          <h2 style={{margin:"10px 0 5px", color:"#444"}}>Join Our Community</h2>
          <p style={{margin:"5px 0 15px", color:"#666", lineHeight: "1.5"}}>
            Create an account to easily manage your pet's health records.
          </p>
        </div>
        
        <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          
          {/* ROW 1: NAMES */}
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <input 
                type="text" 
                placeholder="First Name" 
                onChange={(e) => setFname(e.target.value)} 
                required 
                style={{flex: 1, minWidth: "150px"}}
            />
            <input 
                type="text" 
                placeholder="Last Name" 
                onChange={(e) => setLname(e.target.value)} 
                required 
                style={{flex: 1, minWidth: "150px"}}
            />
          </div>

          {/* ROW 2: EMAIL */}
          <input type="email" placeholder="Email Address" onChange={(e) => setEmail(e.target.value)} required />
          
          {/* ROW 3: PASSWORDS SIDE BY SIDE */}
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-start" }}>
            
            {/* Password Field (Left) */}
            <div style={{ position: "relative", display: "flex", alignItems: "center", flex: 1, minWidth: "180px" }}>
                <input 
                  type={showPassword ? "text" : "password"} 
                  placeholder="Password" 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                  style={{ width: "100%", paddingRight: "35px" }}
                />
                <button
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: "absolute", right: "8px", background: "none", border: "none", cursor: "pointer", color: "#666", padding: "0", display: "flex", alignItems: "center" }}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  )}
                </button>
            </div>

            {/* Confirm Password Field (Right) */}
            <div style={{display: 'flex', flexDirection: 'column', flex: 1, minWidth: "180px" }}>
                <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="Confirm Password" 
                    onChange={(e) => setConfirmPassword(e.target.value)} 
                    required 
                    style={{ 
                        width: "100%",
                        border: isMismatch ? "1px solid #d32f2f" : "1px solid #ccc",
                        outline: isMismatch ? "none" : undefined
                    }}
                />
                {isMismatch && (
                    <span style={{ color: "#d32f2f", fontSize: "11px", marginTop: "3px", textAlign: "left", lineHeight: "1.2" }}>
                        Passwords do not match
                    </span>
                )}
            </div>
          </div>

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

          {/* GENERAL ERROR */}
          {error && (
            <div style={{ color: "#d32f2f", background: "#ffebee", padding: "8px", borderRadius: "4px", fontSize: "12px", textAlign: "left" }}>
                {error}
            </div>
          )}

          <button 
            type="submit" 
            className="action-btn" 
            style={{ background: "#4CAF50", color: "white", width: "100%", padding: "12px", marginTop: "5px" }}
            disabled={loading}
          >
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <p style={{marginTop: "15px", fontSize: "13px", color: "#666"}}>
            Already have an account? <Link to="/login" className="auth-link">Login here</Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;
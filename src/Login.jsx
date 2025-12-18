// src/Login.jsx
import { useState } from "react";
import { auth, db } from "./firebase";
import { signInWithEmailAndPassword, signOut } from "firebase/auth"; 
import { doc, getDoc } from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";
import logoImg from "./assets/logo.png";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false); //
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(""); 
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(""); 

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const userData = docSnap.data();
        
        if (userData.isDisabled === true) {
            await signOut(auth); 
            throw new Error("Your account has been disabled. Please contact the administrator.");
        }

        const role = userData.role;
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
        throw new Error("User record not found in database.");
      }
    } catch (err) {
      console.error(err);
      const message = err.code === 'auth/invalid-credential' 
        ? "Incorrect email or password." 
        : err.message; 
      
      setError(message);
    }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <img src={logoImg} alt="PawPals Logo" className="auth-logo-img" />
          <h2 style={{margin:0, color:"#333"}}>Welcome Back</h2>
          <p style={{margin:"5px 0 0", color:"#666"}}>PawPals Management System</p>
        </div>
        
        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <input 
            type="email" 
            placeholder="Email Address" 
            onChange={(e) => setEmail(e.target.value)} 
            required 
            className="auth-input" 
          />
          
          {/* PASSWORD FIELD WITH TOGGLE */}
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <input 
              type={showPassword ? "text" : "password"} 
              placeholder="Password" 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              className="auth-input"
              style={{ width: "100%", paddingRight: "40px" }} // Add padding for the icon
            />
            <button
              type="button" // Important: type="button" prevents form submission
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: "absolute",
                right: "10px",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#666",
                padding: "0",
                display: "flex",
                alignItems: "center"
              }}
            >
              {showPassword ? (
                // Eye Off Icon (SVG)
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
              ) : (
                // Eye Icon (SVG)
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              )}
            </button>
          </div>
          
          {error && (
            <div style={{
                color: "#d32f2f", 
                background: "#ffebee", 
                padding: "10px", 
                borderRadius: "4px", 
                fontSize: "14px", 
                textAlign: "center"
            }}>
                {error}
            </div>
          )}

          <button 
            type="submit" 
            className="action-btn" 
            style={{ background: "#1565C0", color: "white", width: "100%", padding: "12px", marginTop: "10px" }}
            disabled={loading}
          >
            {loading ? "Verifying Access..." : "Login"}
          </button>
        </form>
        
        <Link to="/signup" className="auth-link">New Pet Owner? Register here</Link>
      </div>
    </div>
  );
};

export default Login;
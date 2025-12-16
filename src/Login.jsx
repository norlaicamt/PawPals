// src/Login.jsx
import { useState } from "react";
import { auth, db } from "./firebase";
import { signInWithEmailAndPassword, signOut } from "firebase/auth"; // Added signOut
import { doc, getDoc } from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";
import logoImg from './logo.png';

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(""); // Added state for cleaner error messages
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(""); // Reset errors

    try {
      // 1. Authenticate with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // 2. Fetch User Data from Firestore
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const userData = docSnap.data();
        
        // --- SECURITY CHECK: IS ACCOUNT DISABLED? ---
        // We check the exact field 'isDisabled' used in your AdminDashboard
        if (userData.isDisabled === true) {
            await signOut(auth); // Immediately kill the session
            throw new Error("Your account has been disabled. Please contact the administrator.");
        }
        // --------------------------------------------

        // 3. Route based on Role
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
      // Determine if it's a specific Firebase error or our custom error
      const message = err.code === 'auth/invalid-credential' 
        ? "Incorrect email or password." 
        : err.message; // Uses the "Disabled" message we threw above
      
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
            className="auth-input" // Assuming you might have CSS for this
          />
          <input 
            type="password" 
            placeholder="Password" 
            onChange={(e) => setPassword(e.target.value)} 
            required 
            className="auth-input"
          />
          
          {/* UI Error Message Display */}
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
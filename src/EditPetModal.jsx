import { useState } from "react";
import { db, auth } from "./firebase";
import { collection, addDoc } from "firebase/firestore";

// --- CONSTANTS (Matches OwnerDashboard) ---
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

const EditPetModal = ({ pet, onClose }) => {
  // --- SAFETY FIX: Handle existing age parsing ---
  const getInitialAgeParts = (val) => {
    if (val === undefined || val === null) return { num: "", unit: "Years" };
    const ageStr = String(val);
    const parts = ageStr.split(" ");
    const unit = parts[1] && parts[1].toLowerCase().startsWith("m") ? "Months" : "Years";
    return { num: parts[0], unit: unit };
  };

  const initialAge = getInitialAgeParts(pet.age);
  
  // Initialize formData with birthdate if it exists in the DB
  const [formData, setFormData] = useState({
    name: pet.name || "",
    breed: pet.breed || "",
    gender: pet.gender || "",
    species: pet.species || "",
    birthdate: pet.birthdate || "" // Add this
  });
  
  // We keep these for display, but they will be calculated
  const [ageNum, setAgeNum] = useState(initialAge.num);
  const [ageUnit, setAgeUnit] = useState(initialAge.unit);

  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);


  // --- HELPER LOGIC FOR DROPDOWNS ---
  // 1. Determine which species is selected for the dropdown ("Other" if not Dog/Cat)
  const speciesSelectValue = ["Dog", "Cat"].includes(formData.species) ? formData.species : "Other";
  
  // 2. Determine available breeds based on species
  let breedOptions = [];
  if (speciesSelectValue === "Dog") breedOptions = DOG_BREEDS;
  else if (speciesSelectValue === "Cat") breedOptions = CAT_BREEDS;
  
  // 3. Determine breed dropdown value
  // If the current breed is in the list, show it. Otherwise show "Other" (which triggers the text input)
  const breedSelectValue = breedOptions.includes(formData.breed) ? formData.breed : "Other";
  
  // --- HANDLERS ---
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSpeciesChange = (e) => {
    const val = e.target.value;
    if (val === "Other") {
        // If switching to Other, clear species so they can type, or set to "Other" placeholder
        setFormData({ ...formData, species: "Other", breed: "" }); 
    } else {
        // If switching to Dog/Cat, reset breed to empty so they pick a new one
        setFormData({ ...formData, species: val, breed: "" });
    }
  };

  const handleBreedSelectChange = (e) => {
     setFormData({ ...formData, breed: e.target.value });
  };

  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      alert("Please provide a reason for this change.");
      return;
    }

    const finalAgeString = `${ageNum} ${ageUnit}`;

    setLoading(true);
    try {
      await addDoc(collection(db, "edit_requests"), {
        petId: pet.id,
        ownerId: auth.currentUser.uid,
        ownerEmail: auth.currentUser.email || "Unknown",
        petName: pet.name,
        originalData: pet,
        // Include birthdate in newData
        newData: { ...formData, age: finalAgeString }, 
        reason: reason,
        status: "pending",
        createdAt: new Date(),
        type: "pet_update"
      });

      setShowSuccess(true);
      
    } catch (error) {
      console.error("Error submitting request:", error);
      alert("Failed to submit request.");
    }
    setLoading(false);
  };

  if (showSuccess) {
    return (
      <div style={{
        position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
        backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000
      }}>
        <div style={{
          backgroundColor: "white", padding: "30px", borderRadius: "8px", width: "90%", maxWidth: "350px", textAlign: "center", boxShadow: "0 4px 15px rgba(0,0,0,0.2)"
        }}>
          <div style={{ width: "50px", height: "50px", background: "#e8f5e9", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 15px" }}>
             <span style={{ color: "#2e7d32", fontSize: "24px" }}>✓</span>
          </div>
          <h3 style={{ margin: "0 0 10px", color: "#333" }}>Request Sent!</h3>
          <p style={{ fontSize: "14px", color: "#666", marginBottom: "20px" }}>
            Your changes have been submitted to the Admin for approval.
          </p>
          <button 
            onClick={onClose} 
            style={{
              background: "#4CAF50", color: "white", border: "none", padding: "10px 25px", 
              borderRadius: "5px", cursor: "pointer", fontWeight: "bold", width: "100%"
            }}
          >
            Okay, Got it
          </button>
        </div>
      </div>
    );
  }

  const handleBirthdateChange = (e) => {
      const newDate = e.target.value;
      setFormData({ ...formData, birthdate: newDate });

      if (newDate) {
        const today = new Date();
        const birthDate = new Date(newDate);
        let months = (today.getFullYear() - birthDate.getFullYear()) * 12;
        months -= birthDate.getMonth();
        months += today.getMonth();
        if (today.getDate() < birthDate.getDate()) months--;
        if (months < 0) months = 0;

        if (months >= 12) {
            setAgeNum(Math.floor(months / 12));
            setAgeUnit("Years");
        } else {
            setAgeNum(months);
            setAgeUnit("Months");
        }
      }
  };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
      backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000
    }}>
      <div style={{
        backgroundColor: "white", padding: "20px", borderRadius: "8px", width: "90%", maxWidth: "450px", maxHeight: "90vh", overflowY: "auto"
      }}>
        <h3 style={{marginTop: 0}}>Request Update for {pet.name}</h3>
        <p style={{fontSize: "12px", color: "#666", marginBottom: "15px"}}>
          Changes require admin approval.
        </p>

        <form onSubmit={handleSubmitRequest} style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
          
          <div style={{display: 'flex', gap: '10px'}}>
             <div style={{flex: 1}}>
                <label style={{fontSize: "12px", fontWeight: "bold"}}>Pet Name:</label>
                <input name="name" value={formData.name} onChange={handleChange} required style={{width: "100%", padding: "8px"}} />
             </div>
             
             {/* SPECIES DROPDOWN */}
             <div style={{flex: 1}}>
                <label style={{fontSize: "12px", fontWeight: "bold"}}>Species:</label>
                <select 
                    value={speciesSelectValue} 
                    onChange={handleSpeciesChange} 
                    style={{width: "100%", padding: "8px", height: "36px"}}
                >
                    <option value="Dog">Dog</option>
                    <option value="Cat">Cat</option>
                </select>
                
                {/* Show text input if "Other" is selected */}
                {speciesSelectValue === "Other" && (
                    <input 
                        name="species" 
                        placeholder="Specify Species" 
                        value={formData.species === "Other" ? "" : formData.species} 
                        onChange={handleChange} 
                        style={{width: "100%", padding: "8px", marginTop: "5px", boxSizing: "border-box"}} 
                    />
                )}
             </div>
          </div>

          {/* BREED DROPDOWN */}
          <div>
            <label style={{fontSize: "12px", fontWeight: "bold"}}>Breed:</label>
            {speciesSelectValue === "Other" ? (
                // If Species is Other, Breed is just a text input
                <input name="breed" value={formData.breed} onChange={handleChange} required style={{width: "100%", padding: "8px", boxSizing: "border-box"}} />
            ) : (
                // If Species is Dog/Cat, Show Dropdown
                <>
                    <select 
                        value={breedSelectValue} 
                        onChange={handleBreedSelectChange} 
                        style={{width: "100%", padding: "8px", marginBottom: breedSelectValue === "Other" ? "5px" : "0"}}
                    >
                        <option value="" disabled>Select Breed</option>
                        {breedOptions.map(b => (
                            <option key={b} value={b}>{b}</option>
                        ))}
                    </select>

                    {/* Show text input if "Other" is selected in Breed */}
                    {breedSelectValue === "Other" && (
                        <input 
                            name="breed" 
                            placeholder="Specify Breed" 
                            value={formData.breed === "Other" ? "" : formData.breed} 
                            onChange={handleChange} 
                            style={{width: "100%", padding: "8px", boxSizing: "border-box"}} 
                        />
                    )}
                </>
            )}
          </div>

          {/* Age Section */}
          {/* Birthdate Section (Replaces manual Age input) */}
          <div>
            <label style={{fontSize: "12px", fontWeight: "bold"}}>Birthdate:</label>
            <input 
                type="date"
                name="birthdate"
                value={formData.birthdate || ""}
                onChange={handleBirthdateChange}
                max={new Date().toISOString().split("T")[0]} // Prevent future dates
                required
                style={{width: "100%", padding: "8px", boxSizing: "border-box", borderRadius: "4px", border: "1px solid #ccc"}}
            />
            
            {/* Read-only view of what the new age will be calculated as */}
            <div style={{marginTop: "5px", padding: "8px", background: "#f5f5f5", borderRadius: "4px", fontSize: "13px", color: "#555", border: "1px solid #eee"}}>
                Calculated Age: <strong>{ageNum} {ageUnit}</strong>
            </div>
          </div>

          <label style={{marginTop: "10px", fontWeight: "bold", fontSize: "14px"}}>Reason for Change (Required):</label>
          <textarea 
            value={reason} 
            onChange={(e) => setReason(e.target.value)} 
            placeholder="Why are you updating this?"
            required
            style={{padding: "8px", minHeight: "60px", width: "100%", boxSizing: "border-box"}}
          />

          <div style={{display: "flex", gap: "10px", marginTop: "15px"}}>
            <button type="button" onClick={onClose} style={{background: "#ccc", border: "none", padding: "10px", borderRadius: "4px", cursor: "pointer"}}>Cancel</button>
            <button type="submit" disabled={loading} style={{background: "#2196F3", color: "white", border: "none", padding: "10px", borderRadius: "4px", cursor: "pointer", flex: 1}}>
              {loading ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditPetModal;
import React from 'react';

import { useState, useEffect } from 'react';
import { PlusCircle, MinusCircle, Trash2, ArrowRight, Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where,
  onSnapshot
} from 'firebase/firestore';

export default function TradingCardTracker() {
  // Active tab state
  const [activeTab, setActiveTab] = useState('sales');
  
  // State for cards
  const [cards, setCards] = useState([]);
  
  // State for shipping supplies
  const [supplies, setSupplies] = useState([]);
  
  // State for misc supplies
  const [miscSupplies, setMiscSupplies] = useState([]);
  
  // State for new card input
  const [newCard, setNewCard] = useState({
    name: "",
    boughtFor: 0,
    soldFor: 0,
    status: "forSale",
    dateBought: new Date().toISOString().split('T')[0],
    dateSold: ""
  });
  
  // State for new misc supply
  const [newMiscSupply, setNewMiscSupply] = useState({
    name: "",
    price: 0
  });
  
  // Search and pagination states
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const cardsPerPage = 50;
  
  // Modal states
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [showMiscSuppliesModal, setShowMiscSuppliesModal] = useState(false);
  
  // Loading state
  const [loading, setLoading] = useState(true);
  
  // Fetch data from Firebase
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      // Set up listeners for real-time updates
      const cardsCollection = collection(db, "cards");
      const unsubscribeCards = onSnapshot(cardsCollection, (snapshot) => {
        const cardsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          boughtFor: parseFloat(doc.data().boughtFor || 0),
          soldFor: parseFloat(doc.data().soldFor || 0)
        }));
        setCards(cardsData);
      });
      
      const suppliesCollection = collection(db, "supplies");
      const unsubscribeSupplies = onSnapshot(suppliesCollection, (snapshot) => {
        const suppliesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          cost: parseFloat(doc.data().cost || 0),
          total: parseFloat(doc.data().total || 0),
          quantity: parseInt(doc.data().quantity || 0)
        }));
        setSupplies(suppliesData);
      });
      
      const miscSuppliesCollection = collection(db, "miscSupplies");
      const unsubscribeMiscSupplies = onSnapshot(miscSuppliesCollection, (snapshot) => {
        const miscSuppliesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          price: parseFloat(doc.data().price || 0)
        }));
        setMiscSupplies(miscSuppliesData);
      });
      
      setLoading(false);
      
      // Clean up listeners on component unmount
      return () => {
        unsubscribeCards();
        unsubscribeSupplies();
        unsubscribeMiscSupplies();
      };
    };
    
    fetchData();
  }, []);
  
  // Calculate totals
  const totalBought = cards.reduce((sum, card) => sum + card.boughtFor, 0);
  const totalSold = cards.reduce((sum, card) => sum + (card.status === "sold" ? card.soldFor : 0), 0);
  const totalSuppliesCost = supplies.reduce((sum, supply) => sum + supply.total, 0);
  const totalMiscCost = miscSupplies.reduce((sum, item) => sum + item.price, 0);
  const totalProfit = totalSold - totalBought - totalSuppliesCost - totalMiscCost;
  
  // Filter cards based on active tab and search term
  const filteredCards = cards.filter(card => {
    const matchesTab = 
      (activeTab === 'sales' && card.status === "sold") ||
      (activeTab === 'forSale' && card.status === "forSale") ||
      (activeTab === 'keeping' && card.status === "keeping");
    
    const matchesSearch = card.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesTab && matchesSearch;
  });
  
  // Calculate pagination
  const indexOfLastCard = currentPage * cardsPerPage;
  const indexOfFirstCard = indexOfLastCard - cardsPerPage;
  const currentCards = filteredCards.slice(indexOfFirstCard, indexOfLastCard);
  const totalPages = Math.ceil(filteredCards.length / cardsPerPage);
  
  // Function to add a new card to Firebase
  const addCard = async () => {
    if (newCard.name.trim() === "") return;
    
    // Determine if card is sold
    const isSold = newCard.status === "sold";
    
    try {
      const cardsCollection = collection(db, "cards");
      await addDoc(cardsCollection, {
        name: newCard.name,
        boughtFor: parseFloat(newCard.boughtFor),
        soldFor: parseFloat(newCard.soldFor || 0),
        isSold: isSold,
        status: newCard.status,
        dateBought: newCard.dateBought,
        dateSold: isSold ? newCard.dateSold : ""
      });
      
      setNewCard({
        name: "",
        boughtFor: 0,
        soldFor: 0,
        status: "forSale",
        dateBought: new Date().toISOString().split('T')[0],
        dateSold: ""
      });
      
      setShowAddCardModal(false);
    } catch (error) {
      console.error("Error adding card: ", error);
    }
  };
  
  // Function to add a new misc supply to Firebase
  const addMiscSupply = async () => {
    if (newMiscSupply.name.trim() === "") return;
    
    try {
      const miscSuppliesCollection = collection(db, "miscSupplies");
      await addDoc(miscSuppliesCollection, {
        name: newMiscSupply.name,
        price: parseFloat(newMiscSupply.price)
      });
      
      setNewMiscSupply({
        name: "",
        price: 0
      });
    } catch (error) {
      console.error("Error adding misc supply: ", error);
    }
  };
  
  // Function to remove a misc supply from Firebase
  const removeMiscSupply = async (id) => {
    try {
      const miscSupplyDoc = doc(db, "miscSupplies", id);
      await deleteDoc(miscSupplyDoc);
    } catch (error) {
      console.error("Error removing misc supply: ", error);
    }
  };
  
  // Function to update card status in Firebase
  const updateCard = async (id, updates) => {
    try {
      const cardDoc = doc(db, "cards", id);
      
      // Handle status changes
      if (updates.status) {
        updates.isSold = updates.status === "sold";
        
        // If moved to sold, set sold date
        if (updates.status === "sold" && !updates.dateSold) {
          updates.dateSold = new Date().toISOString().split('T')[0];
        }
        
        // If moved from sold, clear sold date
        if (updates.status !== "sold") {
          updates.dateSold = "";
        }
      }
      
      await updateDoc(cardDoc, updates);
    } catch (error) {
      console.error("Error updating card: ", error);
    }
  };
  
  // Function to delete card from Firebase
  const deleteCard = async (id) => {
    try {
      const cardDoc = doc(db, "cards", id);
      await deleteDoc(cardDoc);
    } catch (error) {
      console.error("Error deleting card: ", error);
    }
  };
  
  // Function to update supply quantity in Firebase
  const updateSupplyQuantity = async (id, change) => {
    try {
      // Get the current supply
      const supplyDoc = doc(db, "supplies", id);
      const supplyToUpdate = supplies.find(supply => supply.id === id);
      
      if (supplyToUpdate) {
        const newQuantity = Math.max(0, supplyToUpdate.quantity + change);
        const newTotal = parseFloat((newQuantity * supplyToUpdate.cost).toFixed(2));
        
        await updateDoc(supplyDoc, {
          quantity: newQuantity,
          total: newTotal
        });
      }
    } catch (error) {
      console.error("Error updating supply quantity: ", error);
    }
  };
  
  // Function to initialize supplies in Firebase if they don't exist
  useEffect(() => {
    const initializeSupplies = async () => {
      try {
        const suppliesCollection = collection(db, "supplies");
        const suppliesSnapshot = await getDocs(suppliesCollection);
        
        // If no supplies exist, add the default ones
        if (suppliesSnapshot.empty) {
          const defaultSupplies = [
            { name: "Penny Sleeves", quantity: 50, cost: 0.05, total: 2.50 },
            { name: "Top Loaders", quantity: 20, cost: 0.25, total: 5.00 },
            { name: "Envelopes", quantity: 10, cost: 0.15, total: 1.50 },
            { name: "Bubble Mailers", quantity: 5, cost: 0.75, total: 3.75 },
          ];
          
          for (const supply of defaultSupplies) {
            await addDoc(suppliesCollection, supply);
          }
        }
      } catch (error) {
        console.error("Error initializing supplies: ", error);
      }
    };
    
    initializeSupplies();
  }, []);
  
  // Function to change page
  const paginate = (pageNumber) => {
    setCurrentPage(Math.max(1, Math.min(pageNumber, totalPages)));
  };

  // Show loading indicator
  if (loading) {
    return (
      <div className="p-4 max-w-6xl mx-auto text-center">
        <h1 className="text-2xl font-bold mb-6">Loading...</h1>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Trading Card Tracker</h1>
      
      {/* Tab Navigation */}
      <div className="flex mb-4">
        <button 
          className={`px-4 py-2 rounded mr-2 ${activeTab === 'sales' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          onClick={() => setActiveTab('sales')}
        >
          Sold
        </button>
        <button 
          className={`px-4 py-2 rounded mr-2 ${activeTab === 'forSale' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          onClick={() => setActiveTab('forSale')}
        >
          For Sale
        </button>
        <button 
          className={`px-4 py-2 rounded ${activeTab === 'keeping' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          onClick={() => setActiveTab('keeping')}
        >
          Keeping
        </button>
      </div>
      
      {/* Add Card Button */}
      <div className="mb-4">
        <button
          className="bg-green-500 text-white px-4 py-2 rounded flex items-center"
          onClick={() => setShowAddCardModal(true)}
        >
          <PlusCircle size={20} className="mr-2" />
          Add New Card
        </button>
      </div>
      
      {/* Search Bar */}
      <div className="relative mb-4">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search size={18} className="text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search cards..."
          className="pl-10 p-2 border rounded w-full"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1); // Reset to first page on search
          }}
        />
      </div>
      
      {/* Sales Tab Content */}
      {activeTab === 'sales' && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Sold Cards</h2>
          
          {/* Card list header */}
          <div className="grid grid-cols-7 gap-2 font-semibold mb-2 p-2 bg-gray-200 rounded">
            <div>Name</div>
            <div>Bought For</div>
            <div>Sold For</div>
            <div>Profit</div>
            <div>Date Bought</div>
            <div>Date Sold</div>
            <div>Actions</div>
          </div>
          
          {/* Card list */}
          <div className="mb-4">
            {currentCards.length > 0 ? (
              currentCards.map(card => (
                <div key={card.id} className="grid grid-cols-7 gap-2 p-2 border-b items-center">
                  <div>{card.name}</div>
                  <div>${card.boughtFor.toFixed(2)}</div>
                  <div>${card.soldFor.toFixed(2)}</div>
                  <div className={card.soldFor - card.boughtFor >= 0 ? "text-green-600" : "text-red-600"}>
                    ${(card.soldFor - card.boughtFor).toFixed(2)}
                  </div>
                  <div>{card.dateBought}</div>
                  <div>{card.dateSold}</div>
                  <div>
                    <button
                      onClick={() => deleteCard(card.id)}
                      className="text-red-500"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-gray-500">No sold cards found.</div>
            )}
          </div>
          
         {/* Shipping supplies section */}
         <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Shipping Supplies</h2>
            
            {/* Supplies list */}
            <div className="bg-gray-100 p-4 rounded">
              {supplies.map(supply => (
                <div key={supply.id} className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <button
                      onClick={() => updateSupplyQuantity(supply.id, -1)}
                      className="text-red-500 mr-2"
                    >
                      <MinusCircle size={20} />
                    </button>
                    <span className="w-10 text-center">{supply.quantity}</span>
                    <button
                      onClick={() => updateSupplyQuantity(supply.id, 1)}
                      className="text-green-500 ml-2 mr-4"
                    >
                      <PlusCircle size={20} />
                    </button>
                    <span>{supply.name}</span>
                  </div>
                  <div>${supply.total.toFixed(2)}</div>
                </div>
              ))}
              
              {/* Misc supplies */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="flex items-center">
                  <span className="mr-4">Misc Supplies</span>
                  <button
                    onClick={() => setShowMiscSuppliesModal(true)}
                    className="bg-blue-500 text-white px-3 py-1 rounded text-sm"
                  >
                    Manage
                  </button>
                </div>
                <div>${totalMiscCost.toFixed(2)}</div>
              </div>
            </div>
          </div>
          
          {/* Summary section */}
          <div className="bg-blue-100 p-4 rounded">
            <h2 className="text-xl font-semibold mb-2">Summary</h2>
            <div className="grid grid-cols-2 gap-2">
              <div>Total Cards Cost:</div>
              <div>${totalBought.toFixed(2)}</div>
              
              <div>Total Sales:</div>
              <div>${totalSold.toFixed(2)}</div>
              
              <div>Total Standard Supplies Cost:</div>
              <div>${totalSuppliesCost.toFixed(2)}</div>
              
              <div>Total Misc Supplies Cost:</div>
              <div>${totalMiscCost.toFixed(2)}</div>
              
              <div className="font-bold">Total Profit:</div>
              <div className={`font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${totalProfit.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      )}
      
{/* For Sale Tab Content */}
{activeTab === 'forSale' && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Cards For Sale</h2>
          
          {/* Card list header */}
          <div className="grid grid-cols-6 gap-2 font-semibold mb-2 p-2 bg-gray-200 rounded">
            <div>Name</div>
            <div>Bought For</div>
            <div>Sold For</div>
            <div>Date Bought</div>
            <div>Status</div>
            <div>Actions</div>
          </div>
          
          {/* Card list */}
          <div className="mb-4">
            {currentCards.length > 0 ? (
              currentCards.map(card => (
                <div key={card.id} className="grid grid-cols-6 gap-2 p-2 border-b items-center">
                  <div>{card.name}</div>
                  <div>${card.boughtFor.toFixed(2)}</div>
                  <div>
                    <input
                      type="number"
                      className="p-1 border rounded w-24"
                      value={card.soldFor}
                      onChange={(e) => updateCard(card.id, { soldFor: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>{card.dateBought}</div>
                  <div>
                    <select
                      className="p-1 border rounded"
                      value={card.status}
                      onChange={(e) => updateCard(card.id, { status: e.target.value })}
                    >
                      <option value="forSale">For Sale</option>
                      <option value="sold">Sold</option>
                      <option value="keeping">Keeping</option>
                    </select>
                  </div>
                  <div className="flex">
                    <button
                      onClick={() => updateCard(card.id, { status: "sold", dateSold: new Date().toISOString().split('T')[0] })}
                      className="text-blue-500 mr-2"
                      title="Mark as Sold"
                    >
                      <ArrowRight size={20} />
                    </button>
                    <button
                      onClick={() => deleteCard(card.id)}
                      className="text-red-500"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-gray-500">No cards for sale found.</div>
            )}
          </div>
        </div>
      )}
      
      {/* Keeping Tab Content */}
      {activeTab === 'keeping' && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Cards I'm Keeping</h2>
          
          {/* Card list header */}
          <div className="grid grid-cols-4 gap-2 font-semibold mb-2 p-2 bg-gray-200 rounded">
            <div>Name</div>
            <div>Bought For</div>
            <div>Date Bought</div>
            <div>Actions</div>
          </div>
          
          {/* Card list */}
          <div className="mb-4">
            {currentCards.length > 0 ? (
              currentCards.map(card => (
                <div key={card.id} className="grid grid-cols-4 gap-2 p-2 border-b items-center">
                  <div>{card.name}</div>
                  <div>${card.boughtFor.toFixed(2)}</div>
                  <div>{card.dateBought}</div>
                  <div className="flex">
                    <button
                      onClick={() => updateCard(card.id, { status: "forSale" })}
                      className="text-blue-500 mr-2"
                      title="Move to For Sale"
                    >
                      <ArrowRight size={20} />
                    </button>
                    <button
                      onClick={() => deleteCard(card.id)}
                      className="text-red-500"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-gray-500">No cards being kept found.</div>
            )}
          </div>
        </div>
      )}
      
      {/* Pagination Controls */}
      {filteredCards.length > cardsPerPage && (
        <div className="flex justify-center mt-4 mb-4">
          <button
            onClick={() => paginate(currentPage - 1)}
            disabled={currentPage === 1}
            className={`mx-1 px-3 py-1 rounded ${currentPage === 1 ? 'bg-gray-200 cursor-not-allowed' : 'bg-gray-300 hover:bg-gray-400'}`}
          >
            <ChevronLeft size={20} />
          </button>
          
          <div className="flex items-center mx-2">
            <span>Page {currentPage} of {totalPages}</span>
          </div>
          
          <button
            onClick={() => paginate(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={`mx-1 px-3 py-1 rounded ${currentPage === totalPages ? 'bg-gray-200 cursor-not-allowed' : 'bg-gray-300 hover:bg-gray-400'}`}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}
      
      {/* Add Card Modal */}
      {showAddCardModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Add New Card</h3>
              <button onClick={() => setShowAddCardModal(false)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Card Name</label>
                <input
                  type="text"
                  className="p-2 border rounded w-full"
                  value={newCard.name}
                  onChange={(e) => setNewCard({...newCard, name: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Bought For ($)</label>
                <input
                  type="number"
                  className="p-2 border rounded w-full"
                  value={newCard.boughtFor}
                  onChange={(e) => setNewCard({...newCard, boughtFor: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Date Bought</label>
                <input
                  type="date"
                  className="p-2 border rounded w-full"
                  value={newCard.dateBought}
                  onChange={(e) => setNewCard({...newCard, dateBought: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  className="p-2 border rounded w-full"
                  value={newCard.status}
                  onChange={(e) => setNewCard({...newCard, status: e.target.value})}
                >
                  <option value="forSale">For Sale</option>
                  <option value="sold">Sold</option>
                  <option value="keeping">Keeping</option>
                </select>
              </div>
              
              {newCard.status === "sold" && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Sold For ($)</label>
                    <input
                      type="number"
                      className="p-2 border rounded w-full"
                      value={newCard.soldFor}
                      onChange={(e) => setNewCard({...newCard, soldFor: e.target.value})}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Date Sold</label>
                    <input
                      type="date"
                      className="p-2 border rounded w-full"
                      value={newCard.dateSold}
                      onChange={(e) => setNewCard({...newCard, dateSold: e.target.value})}
                    />
                  </div>
                </>
              )}
            </div>
            
            <div className="flex justify-end">
              <button
                className="bg-gray-300 text-gray-800 px-4 py-2 rounded mr-2"
                onClick={() => setShowAddCardModal(false)}
              >
                Cancel
              </button>
              <button
                className="bg-green-500 text-white px-4 py-2 rounded"
                onClick={addCard}
              >
                Add Card
              </button>
            </div>
          </div>
        </div>
      )}
      
 {/* Misc Supplies Modal */}
 {showMiscSuppliesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Manage Miscellaneous Supplies</h3>
              <button onClick={() => setShowMiscSuppliesModal(false)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            
            {/* Current Misc Supplies */}
            <div className="mb-6">
              <h4 className="font-medium mb-2">Current Supplies</h4>
              {miscSupplies.length > 0 ? (
                <div className="bg-gray-100 p-2 rounded">
                  {miscSupplies.map(item => (
                    <div key={item.id} className="flex justify-between items-center p-2 border-b last:border-b-0">
                      <span>{item.name}</span>
                      <div className="flex items-center">
                        <span className="mr-4">${item.price.toFixed(2)}</span>
                        <button
                          onClick={() => removeMiscSupply(item.id)}
                          className="text-red-500"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-500 italic">No miscellaneous supplies added yet.</div>
              )}
            </div>
            
            {/* Add New Misc Supply */}
            <div className="mb-4">
              <h4 className="font-medium mb-2">Add New Supply</h4>
              <div className="flex items-end gap-2">
                <div className="flex-grow">
                  <label className="block text-sm mb-1">Name</label>
                  <input
                    type="text"
                    className="p-2 border rounded w-full"
                    value={newMiscSupply.name}
                    onChange={(e) => setNewMiscSupply({...newMiscSupply, name: e.target.value})}
                    placeholder="e.g., Team Bag, Card Saver"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Price ($)</label>
                  <input
                    type="number"
                    className="p-2 border rounded w-24"
                    value={newMiscSupply.price}
                    onChange={(e) => setNewMiscSupply({...newMiscSupply, price: e.target.value})}
                    placeholder="0.00"
                  />
                </div>
                <button
                  className="bg-green-500 text-white px-4 py-2 rounded"
                  onClick={addMiscSupply}
                >
                  Add
                </button>
              </div>
            </div>
            
            <div className="flex justify-between items-center pt-4 border-t">
              <div>
                <span className="font-bold">Total: ${totalMiscCost.toFixed(2)}</span>
              </div>
              <button
                className="bg-blue-500 text-white px-4 py-2 rounded"
                onClick={() => setShowMiscSuppliesModal(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
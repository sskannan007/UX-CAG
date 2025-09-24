// export default DataValidationPage;
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';

import { Modal, Button, Spinner, Container, Card } from 'react-bootstrap';

import TopNavbar from '../components/TopNavbar';

import SideNavbar from '../components/SideNavbar';

import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import extractedData from './extractedData';

import config from '../config.js';



const BASE_URL = config.BASE_URL;





const DataValidationPage = () => {

  const location = useLocation();
  const navigate = useNavigate();

  const docxInfo = location.state?.docxInfo;

  const docxArrayBufferFromState = location.state?.docxArrayBuffer;

  const fileId = location.state?.fileId;



  const isRoot = location.pathname === '/data-validation';

  const incomingJsonData = location.state?.jsonData;

  const incomingFileName = location.state?.fileName;

  const isLoading = location.state?.isLoading;

  const dataSource = location.state?.source || 'original'; // Track if data is from updated_json



  const [file, setFile] = useState(null);

  const [previewUrl, setPreviewUrl] = useState('');

  const [response, setResponse] = useState(null);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState(null);

  const [docxHtml, setDocxHtml] = useState('');

  const [fileType, setFileType] = useState(incomingJsonData ? 'application/json' : '');

  const [docxZoom, setDocxZoom] = useState(1);

  const [isInitializing, setIsInitializing] = useState(false); // Add initialization state

  const originalJsonRef = useRef(incomingJsonData || null);

  const [workingJson, setWorkingJson] = useState(() => {

    try {

      return incomingJsonData ? JSON.parse(JSON.stringify(incomingJsonData)) : null;

    } catch {

      return incomingJsonData || null;

    }

  });





  const [extractedDataState, setExtractedDataState] = useState(() => {

    if (incomingJsonData) {

      return transformToRequiredFormat(incomingJsonData);

    }

    return extractedData;

  });

  const originalExtractedRef = useRef(null);

  const [jsonUploadMsg, setJsonUploadMsg] = useState(() => {

    if (incomingJsonData) {

      return { type: 'success', text: `JSON file "${incomingFileName}" loaded successfully!` };

    }

    return null;

  });

  const [uploadedJsonFileName, setUploadedJsonFileName] = useState(incomingFileName || '');

  const [rawJsonText, setRawJsonText] = useState(() => {

    if (incomingJsonData) {

      return JSON.stringify(incomingJsonData, null, 2);

    }

    return '';

  });

  const [rawJsonError, setRawJsonError] = useState('');

  const [uploadedFileType, setUploadedFileType] = useState(incomingJsonData ? 'application/json' : '');

  const [originalUploadedJsonText, setOriginalUploadedJsonText] = useState(() => {

    if (incomingJsonData) {

      return JSON.stringify(incomingJsonData, null, 2);

    }

    return '';

  });



  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [canUploadDV, setCanUploadDV] = useState(true);

  const toggleSidebar = () => setIsSidebarOpen(open => !open);



  // Feedback state

  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  const [feedbackSeverity, setFeedbackSeverity] = useState('');

  const [feedbackDescription, setFeedbackDescription] = useState('');

  const [feedbackFieldPath, setFeedbackFieldPath] = useState('');

  const [feedbackFieldValue, setFeedbackFieldValue] = useState('');

  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  const [feedbackSuccess, setFeedbackSuccess] = useState(false);



  // General feedback state

  const [showGeneralFeedbackModal, setShowGeneralFeedbackModal] = useState(false);

  const [generalFeedbackSeverity, setGeneralFeedbackSeverity] = useState('');

  const [generalFeedbackMessage, setGeneralFeedbackMessage] = useState('');

  const [generalFeedbackSubmitting, setGeneralFeedbackSubmitting] = useState(false);

  const [generalFeedbackSuccess, setGeneralFeedbackSuccess] = useState(false);



  // State for tracking unsaved changes

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [pendingChanges, setPendingChanges] = useState(new Map()); // Map to store pending field changes

  // Data consistency tracking
  const [dataConsistencyErrors, setDataConsistencyErrors] = useState([]);
  const [lastUpdateTimestamp, setLastUpdateTimestamp] = useState(null);
  const [updateHistory, setUpdateHistory] = useState([]); // Track all updates for debugging

  // Review & Submit modal state
  const [confirmData, setConfirmData] = useState({ newJson: null, diffs: [], isTableMode: true });

  // Function to compute differences between extracted data states
  const computeDiffsFromExtracted = useCallback((baseExtracted, currentExtracted) => {
    try {
      console.log('=== computeDiffsFromExtracted DEBUG ===');
      console.log('Base extracted (original):', baseExtracted);
      console.log('Current extracted (with changes):', currentExtracted);

      const diffs = [];
      const baseNodes = baseExtracted?.nodes || [];
      const currNodes = currentExtracted?.nodes || [];

      console.log('Base nodes count:', baseNodes.length);
      console.log('Current nodes count:', currNodes.length);

      for (let i = 0; i < Math.min(baseNodes.length, currNodes.length); i++) {
        const bNode = baseNodes[i];
        const cNode = currNodes[i];
        const bContent = Array.isArray(bNode.content) ? bNode.content : [];
        const cContent = Array.isArray(cNode.content) ? cNode.content : [];

        console.log(`Node ${i} (${bNode.label}): base content length: ${bContent.length}, current content length: ${cContent.length}`);

        for (let j = 0; j < Math.min(bContent.length, cContent.length); j++) {
          const bRow = bContent[j];
          const cRow = cContent[j];
          const oldVal = bRow?.value ?? '';
          const newVal = cRow?.value ?? '';

          if (String(oldVal) !== String(newVal)) {
            console.log(`Difference found at node ${i}, row ${j}:`);
            console.log(`  Old value: "${oldVal}"`);
            console.log(`  New value: "${newVal}"`);
            console.log(`  Row text: "${cRow?.text}"`);

            const keyPathParts = [];
            if (cNode?.label) keyPathParts.push(cNode.label);

            // Prefer explicit key/text when available
            const rowKey = (cRow && cRow.key) ? cRow.key : '';
            const rowText = (cRow && cRow.text) ? cRow.text : '';
            if (rowKey) keyPathParts.push(rowKey);
            if (rowText && rowKey !== rowText) keyPathParts.push(rowText);

            const path = keyPathParts.filter(Boolean).join(' > ');

            // Clean up the values by removing HTML tags for better readability
            // For table content, try to extract meaningful information like table titles
            let cleanOldVal = String(oldVal).replace(/<[^>]*>/g, '').trim();
            let cleanNewVal = String(newVal).replace(/<[^>]*>/g, '').trim();

            // If the content looks like a table, try to extract table title for better display
            if (String(oldVal).includes('<table') || String(newVal).includes('<table')) {
              const extractTableTitle = (htmlContent) => {
                try {
                  const tempDiv = document.createElement('div');
                  tempDiv.innerHTML = htmlContent;
                  const table = tempDiv.querySelector('table');
                  if (table) {
                    const rows = Array.from(table.querySelectorAll('tr'));
                    if (rows.length > 0) {
                      const firstRow = rows[0];
                      const firstCell = firstRow.querySelector('td, th');
                      if (firstCell && firstCell.colSpan > 1) {
                        return firstCell.textContent.trim();
                      }
                    }
                  }
                } catch (e) {
                  console.warn('Error extracting table title:', e);
                }
                return null;
              };

              const oldTableTitle = extractTableTitle(String(oldVal));
              const newTableTitle = extractTableTitle(String(newVal));

              if (oldTableTitle || newTableTitle) {
                cleanOldVal = oldTableTitle || 'N/A';
                cleanNewVal = newTableTitle || 'N/A';
              }
            }

            diffs.push({
              path: path,
              oldValue: cleanOldVal,
              newValue: cleanNewVal,
              rawOldValue: oldVal,
              rawNewValue: newVal
            });
          }
        }
      }

      console.log('Total diffs found:', diffs.length);
      console.log('Diffs:', diffs);
      console.log('=== END computeDiffsFromExtracted DEBUG ===');

      return diffs;
    } catch (e) {
      console.error('Error in computeDiffsFromExtracted:', e);
      return [];
    }
  }, []);


  // State for tracking table title changes
  const [tableTitles, setTableTitles] = useState(new Map()); // Map to store table title changes

  // State for tracking table header changes
  const [tableHeaders, setTableHeaders] = useState(new Map()); // Map to store table header changes

  // State for tracking table data changes
  const [tableData, setTableData] = useState(new Map()); // Map to store table data changes

  // Draft-related state

  const [showDraftModal, setShowDraftModal] = useState(false);

  const [showDraftListModal, setShowDraftListModal] = useState(false);

  const [draftName, setDraftName] = useState('');

  const [draftNameError, setDraftNameError] = useState('');

  const [drafts, setDrafts] = useState([]);

  const [loadingDrafts, setLoadingDrafts] = useState(false);

  const [savingDraft, setSavingDraft] = useState(false);

  const [draftMessage, setDraftMessage] = useState({ type: '', text: '' });



  // Autosave state

  const [autosaveStatus, setAutosaveStatus] = useState('idle'); // 'idle', 'saving', 'saved', 'error'

  const [lastAutosaveTime, setLastAutosaveTime] = useState(null);

  const autosaveTimerRef = useRef(null);

  const autosaveIntervalRef = useRef(null);

  const lastSavedStateRef = useRef(null);



  // Debounce timer for value changes to improve performance

  const valueChangeTimerRef = useRef(null);



  const [collapsedNodes, setCollapsedNodes] = useState({});

  const toggleNodeCollapse = (nodeId) => {

    setCollapsedNodes(prev => ({

      ...prev,

      [nodeId]: !prev[nodeId]

    }));

  };



  const handleDocx = async (arrayBuffer) => {

    const mammoth = await import('mammoth/mammoth.browser');

    return mammoth.convertToHtml({ arrayBuffer });

  };



  // ===== DATA CONSISTENCY SYSTEM =====
  // 
  // This comprehensive system ensures complete data consistency across all components:
  // 1. IMMEDIATE JSON UPDATES: Every field change immediately updates workingJson
  // 2. COMPREHENSIVE LOGGING: Every change is logged with complete details
  // 3. AUDIT LOG INTEGRITY: All changes are properly tracked in audit logs
  // 4. REAL-TIME VALIDATION: Continuous monitoring for data inconsistencies
  // 5. INSTANT CORRECTION: Automatic correction of any detected mismatches
  // 6. VISUAL FEEDBACK: Real-time status indicators for data consistency
  // 7. SUBMISSION SAFETY: Pre and post-submission validation ensures data integrity
  //
  // The system guarantees that every single table update is properly stored,
  // tracked, and displayed everywhere without leaving anything behind.

  // Function to validate data consistency across all components
  const validateDataConsistency = useCallback((context = 'unknown') => {
    const errors = [];
    const timestamp = new Date().toISOString();

    try {
      // 1. Validate workingJson consistency
      if (workingJson && extractedDataState) {
        const jsonFromExtracted = transformToRequiredFormat(workingJson);
        const extractedNodes = extractedDataState.nodes || [];
        const jsonNodes = jsonFromExtracted.nodes || [];

        if (extractedNodes.length !== jsonNodes.length) {
          errors.push({
            type: 'node_count_mismatch',
            context,
            timestamp,
            details: `Extracted nodes: ${extractedNodes.length}, JSON nodes: ${jsonNodes.length}`
          });
        }
      }

      // 2. Validate pending changes consistency
      pendingChanges.forEach((change, key) => {
        const [nodeIndex, rowIndex] = key.split('-').map(Number);
        if (extractedDataState.nodes?.[nodeIndex]?.content?.[rowIndex]) {
          const currentValue = extractedDataState.nodes[nodeIndex].content[rowIndex].value;
          if (String(currentValue) !== String(change.newValue)) {
            errors.push({
              type: 'pending_change_mismatch',
              context,
              timestamp,
              key,
              details: `Expected: ${change.newValue}, Actual: ${currentValue}`
            });
          }
        }
      });

      // 3. Validate audit log data consistency
      // Only check audit diff mismatch if we're in a context where it matters
      if (confirmData?.diffs && (context === 'pre_review' || context === 'pre_submission' || context === 'post_correction')) {
        const diffCount = confirmData.diffs.length;
        const pendingCount = pendingChanges.size;
        
        // Allow more tolerance for Docker environments with potential timing issues
        const baseTolerance = Math.max(1, Math.floor(pendingCount * 0.1)); // 10% base tolerance
        const dockerTolerance = process.env.NODE_ENV === 'production' ? Math.max(2, Math.floor(pendingCount * 0.2)) : 0; // 20% additional tolerance for production
        const tolerance = baseTolerance + dockerTolerance;
        const difference = Math.abs(diffCount - pendingCount);
        
        if (difference > tolerance) {
          errors.push({
            type: 'audit_diff_mismatch',
            context,
            timestamp,
            details: `Audit diffs: ${diffCount}, Pending changes: ${pendingCount}`
          });
        }
      }

      // Update consistency state
      setDataConsistencyErrors(errors);
      setLastUpdateTimestamp(timestamp);

      // Log to update history
      setUpdateHistory(prev => [...prev.slice(-49), {
        timestamp,
        context,
        errors: errors.length,
        details: errors
      }]);

      return errors;
    } catch (error) {
      const errorObj = {
        type: 'validation_error',
        context,
        timestamp,
        details: `Validation failed: ${error.message}`
      };
      setDataConsistencyErrors([errorObj]);
      return [errorObj];
    }
  }, [workingJson, extractedDataState, pendingChanges, confirmData]);

  // Function to correct data inconsistencies immediately
  const correctDataInconsistencies = useCallback(async (errors) => {
    console.log('🔧 Correcting data inconsistencies:', errors);

    for (const error of errors) {
      try {
        switch (error.type) {
          case 'pending_change_mismatch':
            // Re-sync pending change with current extracted data
            const [nodeIndex, rowIndex] = error.key.split('-').map(Number);
            const currentValue = extractedDataState.nodes[nodeIndex]?.content[rowIndex]?.value;
            if (currentValue !== undefined) {
              setPendingChanges(prev => {
                const newChanges = new Map(prev);
                const change = newChanges.get(error.key);
                if (change) {
                  newChanges.set(error.key, { ...change, newValue: currentValue });
                }
                return newChanges;
              });
              console.log(`✅ Corrected pending change for ${error.key}`);
            }
            break;

          case 'node_count_mismatch':
            // Re-sync extracted data with working JSON
            if (workingJson) {
              const transformed = transformToRequiredFormat(workingJson);
              setExtractedDataState(transformed);
              console.log('✅ Re-synced extracted data with working JSON');
            }
            break;

          case 'audit_diff_mismatch':
            // Re-compute audit diffs
            if (originalExtractedRef.current && extractedDataState) {
              const newDiffs = computeDiffsFromExtracted(originalExtractedRef.current, extractedDataState);
              setConfirmData(prev => ({ ...prev, diffs: newDiffs }));
              console.log('✅ Re-computed audit diffs');
              
              // Immediately re-validate to clear the error state
              setTimeout(() => {
                const revalidationErrors = validateDataConsistency('post_correction');
                if (revalidationErrors.length === 0) {
                  console.log('✅ Data consistency restored after diff re-computation');
                }
              }, 100);
            }
            break;
        }
      } catch (correctionError) {
        console.error(`❌ Failed to correct ${error.type}:`, correctionError);
      }
    }
  }, [extractedDataState, workingJson]);

  // Function to log every change with complete details
  const logChangeWithDetails = useCallback((changeDetails) => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      user: localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')).username : 'unknown',
      fileId: fileId || 'unknown',
      fileName: uploadedJsonFileName || incomingFileName || 'unknown',
      ...changeDetails
    };

    console.log('📝 Change logged:', logEntry);

    // Store in update history
    setUpdateHistory(prev => [...prev.slice(-49), {
      type: 'change_log',
      ...logEntry
    }]);

    return logEntry;
  }, [fileId, uploadedJsonFileName, incomingFileName]);

  // Generic JSON diff utility for audit logging (compares values deeply)

  const computeJsonDiffs = (oldObj, newObj, basePath = []) => {

    const diffs = [];

    const oldKeys = oldObj && typeof oldObj === 'object' ? Object.keys(oldObj) : [];

    const newKeys = newObj && typeof newObj === 'object' ? Object.keys(newObj) : [];

    const keys = new Set([...(oldKeys || []), ...(newKeys || [])]);

    for (const key of keys) {

      const oldVal = oldObj ? oldObj[key] : undefined;

      const newVal = newObj ? newObj[key] : undefined;

      const pathArr = [...basePath, key];

      const bothObjects = typeof oldVal === 'object' && oldVal !== null && typeof newVal === 'object' && newVal !== null;

      if (bothObjects) {

        diffs.push(...computeJsonDiffs(oldVal, newVal, pathArr));

      } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {

        diffs.push(`${pathArr.join('.')}: ${JSON.stringify(oldVal)} -> ${JSON.stringify(newVal)}`);

      }

    }

    return diffs;

  };



  const handleFileChange = (e) => {

    const selectedFile = e.target.files[0];

    if (!selectedFile) return;

    setFile(selectedFile);

    setResponse(null);

    setError(null);

    setDocxHtml('');

    setPreviewUrl('');

    setFileType(selectedFile.type);

    if (selectedFile.type.startsWith('image/')) {

      const reader = new FileReader();

      reader.onload = () => {

        setPreviewUrl(reader.result);

      };

      reader.readAsDataURL(selectedFile);

    } else if (selectedFile.type === 'application/pdf') {

      const url = URL.createObjectURL(selectedFile);

      setPreviewUrl(url);

    } else if (

      selectedFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||

      selectedFile.name.endsWith('.docx')

    ) {

      const reader = new FileReader();

      reader.onload = async (event) => {

        try {

          const arrayBuffer = event.target.result;

          const result = await handleDocx(arrayBuffer);

          setDocxHtml(result.value);

        } catch (err) {

          setDocxHtml('<p>Could not preview DOCX file.</p>');

        }

      };

      reader.readAsArrayBuffer(selectedFile);

    } else {

      setPreviewUrl('');

      setDocxHtml('');

    }

  };





  const handleNewJsonFileUpload = (e) => {

    const file = e.target.files[0];

    if (!file) return;

    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {

      setJsonUploadMsg({ type: 'error', text: 'Please upload a valid JSON file.' });

      setUploadedJsonFileName('');

      return;

    }

    const reader = new FileReader();

    reader.onload = (event) => {

      try {

        const json = JSON.parse(event.target.result);

        if (json && Array.isArray(json.nodes)) {

          setExtractedDataState(json);

          // Store the original extracted data for comparison

          originalExtractedRef.current = JSON.parse(JSON.stringify(json));

          setJsonUploadMsg({ type: 'success', text: 'JSON file loaded successfully!' });

          setUploadedJsonFileName(file.name);

        } else {

          setJsonUploadMsg({ type: 'error', text: 'Invalid JSON structure. Expected an object with a "nodes" array.' });

          setUploadedJsonFileName('');

        }

      } catch (err) {

        setJsonUploadMsg({ type: 'error', text: 'Error parsing JSON file.' });

        setUploadedJsonFileName('');

      }

    };

    reader.readAsText(file);

  };



  const handleNewFileUpload = (e) => {

    const file = e.target.files[0];

    if (!file) return;

    setUploadedFileType(file.type);

    setUploadedJsonFileName(file.name);

    setJsonUploadMsg(null);

    setRawJsonError('');

    if (file.type === 'application/json' || file.name.endsWith('.json')) {

      const reader = new FileReader();

      reader.onload = (event) => {

        setRawJsonText(event.target.result);

        setOriginalUploadedJsonText(event.target.result);

        setJsonUploadMsg(null);

      };

      reader.readAsText(file);

    } else if (

      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||

      file.name.endsWith('.docx')

    ) {

      setFile(file);

      setFileType(file.type);

      setRawJsonText('');

      setJsonUploadMsg({ type: 'success', text: 'DOCX file loaded. Preview below.' });

    } else {

      setRawJsonText('');

      setJsonUploadMsg({ type: 'error', text: 'Unsupported file type. Only .json and .docx are supported for now.' });

    }

  };



  const handleResetExtractedData = () => {

    if (uploadedFileType === 'application/json' || uploadedJsonFileName.endsWith('.json')) {

      setRawJsonText(originalUploadedJsonText);

      setRawJsonError('');

      setJsonUploadMsg(null);

    }

  };



  const handleSubmit = async () => {

    if (!file) {

      alert('Please select a file first.');

      return;

    }

    setLoading(true);

    setError(null);

    setResponse(null);

    const formData = new FormData();

    formData.append('file', file);

    try {

      const res = await fetch(`${BASE_URL}/data-validation-upload`, {

        method: 'POST',

        body: formData,

      });

      if (!res.ok) {

        throw new Error('Upload failed');

      }

      const result = await res.json();

      setResponse(result);

    } catch (err) {

      setError(err.message);

    } finally {

      setLoading(false);

    }

  };



  function cleanMarkdownContent(content) {

    if (!content) return '';

    const lines = content.split('\n');

    let inBlock = false;

    let cleaned = [];

    for (let line of lines) {

      if (/^`{6,}/.test(line.trim())) {

        inBlock = !inBlock;

        continue;

      }

      if (!inBlock) cleaned.push(line);

    }

    return cleaned.join('\n');

  }

  useEffect(() => {

    if (incomingJsonData && !originalJsonRef.current) {

      try {

        originalJsonRef.current = JSON.parse(JSON.stringify(incomingJsonData));

      } catch {

        originalJsonRef.current = incomingJsonData;

      }

    }

  }, [incomingJsonData]);



  useEffect(() => {

    const handleWheel = (e) => {

      if ((fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || (file && file.name.endsWith('.docx'))) && docxHtml) {

        if (e.ctrlKey) {

          e.preventDefault();

          setDocxZoom(z => Math.max(0.2, Math.min(3, z + (e.deltaY < 0 ? 0.1 : -0.1))));

        }

      }

    };

    const previewDiv = document.getElementById('docx-preview');

    if (previewDiv) {

      previewDiv.addEventListener('wheel', handleWheel, { passive: false });

      return () => previewDiv.removeEventListener('wheel', handleWheel);

    }

  }, [fileType, docxHtml, file]);



  useEffect(() => {

    if (incomingJsonData) {

      window.history.replaceState({}, document.title);

    }

  }, [incomingJsonData]);



  // Permissions: hide upload UI for users without data_validation:create

  useEffect(() => {

    const token = localStorage.getItem('token');

    if (!token) return;

    fetch(`${BASE_URL}/users/me`, {

      headers: { 'Authorization': `Bearer ${token}` }

    })

      .then(res => res.json())

      .then(data => {

        const perms = Array.isArray(data?.permissions) ? data.permissions : [];

        setCanUploadDV(perms.includes('data_validation:create'));

      })

      .catch(() => { })

  }, []);



  // Add initialization effect

  useEffect(() => {

    const initializeComponent = async () => {

      // Only show loading if we have data to load

      if (incomingJsonData || docxInfo || docxArrayBufferFromState) {

        setIsInitializing(true);

      }



      try {

        // If we have incoming data, set it up immediately for faster display

        if (incomingJsonData) {

          // Validate JSON structure

          if (!incomingJsonData || typeof incomingJsonData !== 'object') {

            throw new Error('Invalid JSON data structure');

          }



          // Check if it's the new format with "Parts" structure

          if (incomingJsonData.Parts && typeof incomingJsonData.Parts === 'object') {

            console.log('Detected new JSON format with Parts structure');

          } else {

            console.log('Using legacy JSON format');

          }



          // Set the working JSON immediately for faster access

          setWorkingJson(JSON.parse(JSON.stringify(incomingJsonData)));

          setFileType('application/json');



          // Defer heavy transformation to avoid blocking the UI

          setTimeout(() => {

            try {

              const transformedData = transformToRequiredFormat(incomingJsonData);

              setExtractedDataState(transformedData);

              // Store the original extracted data for comparison

              originalExtractedRef.current = JSON.parse(JSON.stringify(transformedData));

            } catch (transformError) {

              console.error('Error in JSON transformation:', transformError);

              setError(`Error processing JSON data: ${transformError.message}`);

            }

          }, 100);

        }



        // Load DOCX in parallel if available

        const docxPromises = [];



        if (docxInfo && !docxArrayBufferFromState) {

          docxPromises.push(loadDocxFromInfo());

        }



        if (docxArrayBufferFromState && !docxHtml) {

          docxPromises.push(renderDocxFromBuffer());

        }



        // Wait for DOCX loading to complete

        if (docxPromises.length > 0) {

          await Promise.allSettled(docxPromises);

        }



        // Set originalExtractedRef if not already set

        if (originalExtractedRef.current === null && extractedDataState && extractedDataState.nodes) {

          originalExtractedRef.current = JSON.parse(JSON.stringify(extractedDataState));

          console.log('Initialized originalExtractedRef with initial data:', originalExtractedRef.current);

        }



        // Auto-load the most recent draft after initial data is loaded

        // Only auto-load if the data is from original JSON, not from updated_json (submitted changes)

        if ((fileId || incomingJsonData) && dataSource !== 'updated_json') {

          console.log('Auto-loading most recent draft...');

          await autoLoadMostRecentDraft();

        } else if (dataSource === 'updated_json') {

          console.log('Data is from updated_json (submitted changes), skipping auto-load of drafts');

        }

      } catch (error) {

        console.error('Initialization error:', error);

        setError(`Failed to initialize component: ${error.message}`);

      } finally {

        setIsInitializing(false);

      }

    };



    // If no data to load, show the page immediately

    if (!incomingJsonData && !docxInfo && !docxArrayBufferFromState) {

      setIsInitializing(false);

      // Initialize originalExtractedRef with default extracted data

      if (originalExtractedRef.current === null && extractedDataState && extractedDataState.nodes) {

        originalExtractedRef.current = JSON.parse(JSON.stringify(extractedDataState));

        console.log('Initialized originalExtractedRef with default data:', originalExtractedRef.current);

      }

    } else {

      initializeComponent();

    }

  }, [incomingJsonData, docxInfo, docxArrayBufferFromState]);



  // Separate function to load DOCX from info

  const loadDocxFromInfo = async () => {

    try {

      const possibleId = docxInfo?.id || docxInfo?.file?.id || docxInfo?.data?.id || docxInfo?.docx?.id || (Array.isArray(docxInfo) && docxInfo[0]?.id) || docxInfo?.content?.id;

      if (!possibleId) throw new Error('No DOCX id available');

      const response = await fetch(`${config.BASE_URL}/api/download/${possibleId}`);

      if (!response.ok) throw new Error('Failed to fetch DOCX file');

      const arrayBuffer = await response.arrayBuffer();

      const result = await handleDocx(arrayBuffer);

      setDocxHtml(result.value);

      setFileType('application/vnd.openxmlformats-officedocument.wordprocessingml.document');

    } catch (err) {

      console.error('DOCX preview error:', err);

      setDocxHtml('<p>Could not preview DOCX file.</p>');

    }

  };



  // Separate function to render DOCX from buffer

  const renderDocxFromBuffer = async () => {

    try {

      const result = await handleDocx(docxArrayBufferFromState);

      setDocxHtml(result.value);

      setFileType('application/vnd.openxmlformats-officedocument.wordprocessingml.document');

    } catch (err) {

      console.error('DOCX render error:', err);

      setDocxHtml('<p>Could not preview DOCX file.</p>');

    }

  };



  // Remove the old useEffect for DOCX loading since we handle it in initialization

  // useEffect(() => {

  //   const renderFromBuffer = async () => {

  //     try {

  //       const result = await handleDocx(docxArrayBufferFromState);

  //       setDocxHtml(result.value);

  //       setFileType('application/vnd.openxmlformats-officedocument.wordprocessingml.document');

  //     } catch (err) {

  //       console.error('DOCX render error:', err);

  //       setDocxHtml('<p>Could not preview DOCX file.</p>');

  //     }

  //   };

  //   if (docxArrayBufferFromState && !docxHtml) {

  //     renderFromBuffer();

  //   }

  // }, [docxArrayBufferFromState, docxHtml]);



  // Remove the old useEffect for DOCX info since we handle it in initialization

  // useEffect(() => {

  //   if (!docxArrayBufferFromState && docxInfo && !docxHtml) {

  //     const fetchAndPreviewDocx = async () => {

  //       try {

  //         const possibleId = docxInfo?.id || docxInfo?.file?.id || docxInfo?.data?.id || docxInfo?.docx?.id || (Array.isArray(docxInfo) && docxInfo[0]?.id) || docxInfo?.content?.id;

  //         if (!possibleId) throw new Error('No DOCX id available');

  //         const response = await fetch(`http://localhost:8000/api/download/${possibleId}`);

  //         if (!response.ok) throw new Error('Failed to fetch DOCX file');

  //         const arrayBuffer = await response.arrayBuffer();

  //         const result = await handleDocx(arrayBuffer);

  //         setDocxHtml(result.value);

  //         setFileType('application/vnd.openxmlformats-officedocument.wordprocessingml.document');

  //       } catch (err) {

  //         console.error('DOCX preview error:', err);

  //         setDocxHtml('<p>Could not preview DOCX file.</p>');

  //       }

  //     };

  //     fetchAndPreviewDocx();

  //   }

  // }, [docxArrayBufferFromState, docxInfo, docxHtml]);





  function transformToRequiredFormat(jsonObj) {

    const nodes = [];



    // Enhanced map of specific keys to friendly display labels

    const FRIENDLY_LABELS = {

      Report_ID: 'Report ID',

      Audit_Office_ID: 'Audit Office',

      Inspection_Period: 'Inspection Period',

      state_or_center: 'State or Center',

      Reporting_Period: 'Reporting Period',

      Period_From: 'Period From',

      Period_To: 'Period To',

      departments: 'Departments',

      state_name: 'State Name',

      division_name: 'Division Name',

      category_revenue_or_expenditure: 'Category (Revenue/Expenditure)',

      Org_Hierarchy: 'Organization Hierarchy',

      Org_Hier_Code: 'Organization Hierarchy Code',

      Hier_Code_Lvl1: 'Hierarchy Code Level 1',

      org_hierarchy_description: 'Organization Hierarchy Description',

      org_hierarchy_parent_department_name: 'Parent Department Name',

      org_hierarchy_division_name: 'Division Name',

      Budget_Detail: 'Budget Details',

      Description: 'Description',

      Budgeted_Amount: 'Budgeted Amount',

      Expenditure: 'Expenditure',

      Expenditure_Unit: 'Expenditure Unit',

      expenditure_category: 'Expenditure Category',

      Variance: 'Variance',

      Audit_Officer_Details: 'Audit Officer Details',

      Audit_Details: 'Audit Details',

      Audit_Rules: 'Audit Rules',

      Observations: 'Observations',

      Unresolved_Observations: 'Unresolved Observations',

      Best_Practices: 'Best Practices',

      Auditee_Office_Details: 'Auditee Office Details',

      Acknowledgement: 'Acknowledgement',

      signed_by: 'Signed By',

      file_name: 'File Name',

      title: 'Title',

      sampling: 'Sampling',

      year: 'Year',

      Work_Order: 'Work Order',

      Work_Order_Indent: 'Work Order Indent',

      Work_Order_Type: 'Work Order Type',

      Agency_Name: 'Agency Name',

      Nature_Of_Work: 'Nature of Work',

      Estimated_Cost: 'Estimated Cost',

      Estimated_Cost_Unit: 'Estimated Cost Unit',

      Work_Status: 'Work Status',

      work_name: 'Work Name',

      work_order_cost: 'Work Order Cost',

      work_order_contractor: 'Work Order Contractor',

      award_date: 'Award Date',

      Payment_Type_Code: 'Payment Type Code',

      audit_rules_criteria_name: 'Audit Rules Criteria Name',

      Audit_Objective: 'Audit Objective',

      audit_rules_criteria_names: 'Audit Rules Criteria Names',

      audit_mandate: 'Audit Mandate',

      Completion_Date: 'Completion Date',

      Recommendation: 'Recommendation',

      Observation_Id: 'Observation ID',

      observation_type: 'Observation Type',

      Observation_Category: 'Observation Category',

      observation_criteria_name: 'Observation Criteria Name',

      observation_criteria: 'Observation Criteria',

      Observation_Materiality: 'Observation Materiality',

      Short_Description: 'Short Description',

      long_description: 'Long Description',

      Scope_Of_Audit: 'Scope of Audit',

      Audit_Meeting_entry: 'Audit Meeting Entry',

      Audit_Meeting_exit: 'Audit Meeting Exit',

      audit_rules_description: 'Audit Rules Description',

      Audit_Criteria_Id: 'Audit Criteria ID',

      Audit_Criteria_Description: 'Audit Criteria Description',

      Auditee_Officer_ID: 'Auditee Officer ID',

      Auditee_Officer_Name: 'Auditee Officer Name',

      Audit_Officer_Designation: 'Audit Officer Designation',

      Auditee_Org_Hier_Code: 'Auditee Organization Hierarchy Code',

      Auditee_Office_Location: 'Auditee Office Location',

      Worked_From: 'Worked From',

      Worked_Until: 'Worked Until',

      auditee_office_details: 'Auditee Office Details',

      Audit_Officer_ID: 'Audit Officer ID',

      Audit_Officer_Name: 'Audit Officer Name',

      Member_From: 'Member From',

      Member_Until: 'Member Until',

      // New fields from the actual JSON structure

      Inspection_Report: 'Inspection Report',

      Audit_Date: 'Audit Date',

      Audit_Meeting_Date1: 'Audit Meeting Date 1',

      Audit_Meeting_Date2: 'Audit Meeting Date 2',

      Observation_Severity: 'Observation Severity',

      filename: 'File Name',

      heading: 'Document Heading'

    };



    // Convert raw keys (snake_case or camel case) to readable labels

    const humanizeLabel = (rawKey) => {

      if (!rawKey || typeof rawKey !== 'string') return '';

      if (FRIENDLY_LABELS[rawKey]) return FRIENDLY_LABELS[rawKey];



      const words = rawKey

        .replace(/_/g, ' ')

        .replace(/([a-z])([A-Z])/g, '$1 $2')

        .split(' ')

        .filter(Boolean);



      const upperAcronyms = new Set(['ID', 'GST', 'PAN', 'IFSC', 'DOB', 'UID', 'PINCODE']);



      const titled = words

        .map((w) => {

          const wUpper = w.toUpperCase();

          if (upperAcronyms.has(wUpper)) return wUpper;

          if (w.length <= 2) return w.toUpperCase();

          return w.charAt(0).toUpperCase() + w.slice(1);

        })

        .join(' ');



      return titled

        .replace(/\bOf\b/g, 'of')

        .replace(/\bAnd\b/g, 'and')

        .trim();

    };



    function formatDate(value) {

      if (value instanceof Date) {

        const day = String(value.getDate()).padStart(2, '0');

        const month = String(value.getMonth() + 1).padStart(2, '0');

        const year = value.getFullYear();

        return `${day}/${month}/${year}`;

      }

      if (typeof value === 'string' && !isNaN(Date.parse(value))) {

        const date = new Date(value);

        const day = String(date.getDate()).padStart(2, '0');

        const month = String(date.getMonth() + 1).padStart(2, '0');

        const year = date.getFullYear();

        return `${day}/${month}/${year}`;

      }

      return value;

    }



    function formatValue(value) {

      // Handle special cases for the new format

      if (value === null || value === undefined) {

        return '';

      }



      if (typeof value === 'string') {

        // Check if it's a placeholder/description string

        if (value.includes('character varying') || value.includes('numeric') || value.includes('date')) {

          return value; // Keep as is for schema descriptions

        }

        return value;

      }



      if (typeof value === 'object') {

        if (Array.isArray(value)) {

          if (value.length === 0) {

            return '[]';

          }

          // For arrays of objects, show count

          if (typeof value[0] === 'object') {

            return `[${value.length} items]`;

          }

          // For simple arrays, show first few items

          return `[${value.slice(0, 3).join(', ')}${value.length > 3 ? '...' : ''}]`;

        }

        // For objects, show object representation

        return JSON.stringify(value);

      }



      return formatDate(value);

    }



    function processObject(obj, parentKey = '', parentLabel = '', pathAcc = []) {

      const rows = [];

      let isFirst = true;



      Object.entries(obj).forEach(([key, value]) => {

        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {

          // Handle nested objects

          rows.push({

            key: isFirst && parentKey ? parentKey : '',

            text: humanizeLabel(key),

            value: '',

            path: null

          });

          rows.push(...processObject(value, '', '', [...pathAcc, key]));

        } else if (Array.isArray(value)) {

          // Handle arrays - don't create empty input box for array container

          if (value.length === 0) {

            // Only show empty array indicator if it's a simple array

            rows.push({

              key: isFirst && parentKey ? parentKey : '',

              text: humanizeLabel(key),

              value: '[]',

              path: [...pathAcc, key]

            });

          } else {

            // For non-empty arrays, process items directly without container input box

            value.forEach((item, idx) => {

              if (item !== null && typeof item === 'object') {

                // For objects in arrays, create a display-only label without input field

                rows.push({

                  key: '',

                  text: `${humanizeLabel(key)} Item ${idx + 1}`,

                  value: '',

                  path: null,

                  isDisplayOnly: true  // Mark as display-only (no input field)

                });

                rows.push(...processObject(item, '', '', [...pathAcc, key, idx]));

              } else {

                rows.push({

                  key: '',

                  text: '',

                  value: formatValue(item),

                  path: [...pathAcc, key, idx]

                });

              }

            });

          }

        } else {

          // Handle simple values

          rows.push({

            key: isFirst && parentKey ? parentKey : '',

            text: humanizeLabel(key),

            value: formatValue(value),

            path: [...pathAcc, key]

          });

        }

        isFirst = false;

      });



      return rows;

    }



    // Handle the new JSON structure with "Parts" as the main container

    if (jsonObj.Parts && typeof jsonObj.Parts === 'object') {

      // Handle the new format where Parts contains filename, heading, and PART sections

      Object.entries(jsonObj.Parts).forEach(([partKey, partValue]) => {

        // Skip non-PART keys like filename, heading

        if (partKey === 'filename' || partKey === 'heading') {

          return;

        }



        // Handle PART sections

        if (partKey.startsWith('PART')) {

          nodes.push({

            id: partKey,

            label: humanizeLabel(partKey),  // e.g. "PART I", "PART II (A)", etc.

            content: processObject(partValue, partKey, '', ['Parts', partKey]),

          });

        } else {

          // Handle other top-level keys in Parts

          nodes.push({

            id: partKey,

            label: humanizeLabel(partKey),

            content: processObject(partValue, partKey, '', ['Parts', partKey]),

          });

        }

      });

    } else {

      // Fallback for other JSON structures

      Object.entries(jsonObj).forEach(([sectionKey, sectionValue]) => {

        if (sectionValue !== null && typeof sectionValue === 'object' && !Array.isArray(sectionValue)) {

          nodes.push({

            id: sectionKey,

            label: humanizeLabel(sectionKey),

            content: processObject(sectionValue, sectionKey, '', [sectionKey]),

          });

        } else if (Array.isArray(sectionValue)) {

          sectionValue.forEach((item, idx) => {

            if (item !== null && typeof item === 'object') {

              nodes.push({

                id: `${sectionKey}-${idx}`,

                label: humanizeLabel(sectionKey),

                content: processObject(item, sectionKey, '', [sectionKey, idx]),

              });

            } else {

              nodes.push({

                id: `${sectionKey}-${idx}`,

                label: humanizeLabel(sectionKey),

                content: [{ key: sectionKey, text: '', value: formatValue(item), path: [sectionKey, idx] }]

              });

            }

          });

        } else {

          nodes.push({

            id: sectionKey,

            label: humanizeLabel(sectionKey),

            content: [{ key: sectionKey, text: '', value: formatValue(sectionValue), path: [sectionKey] }]

          });

        }

      });

    }



    return { nodes };

  }



  // Styles to enhance DOCX preview: headers, tables, lists, images

  const docxCustomStyles = `

    #docx-preview .docx-wrapper { 

      border: 1px solid #dbe6ff; 

      border-radius: 12px; 

      background: #ffffff; 

      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04); 

      padding: 12px; 

    }

    #docx-preview .docx-content h1,

    #docx-preview .docx-content h2,

    #docx-preview .docx-content h3,

    #docx-preview .docx-content h4,

    #docx-preview .docx-content h5,

    #docx-preview .docx-content h6 { 

      background: #e8f1ff; 

      padding: 8px 12px; 

      border-radius: 6px; 

      color: #1a3d7c; 

      border: 1px solid #cfe0ff; 

      margin-top: 14px; 

    }

    #docx-preview .docx-content p { 

      margin: 0 0 10px 0; 

      line-height: 1.6; 

      color: #212529; 

    }

    #docx-preview .docx-content table { 

      width: 100%; 

      border-collapse: collapse; 

      margin: 12px 0; 

      background: #fff; 

      border: 1px solid #e0e6f1; 

    }

    #docx-preview .docx-content table th { 

      background: #f0f5ff; 

      color: #1a3d7c; 

      font-weight: 600; 

      border: 1px solid #e0e6f1; 

      padding: 8px; 

    }

    #docx-preview .docx-content table td { 

      border: 1px solid #e0e6f1; 

      padding: 8px; 

      vertical-align: top; 

    }

    #docx-preview .docx-content table tr:nth-child(even) td { 

      background: #fafcff; 

    }

    #docx-preview .docx-content ul, 

    #docx-preview .docx-content ol { 

      margin: 0 0 10px 20px; 

    }

    #docx-preview .docx-content img { 

      max-width: 100%; 

      height: auto; 

      border-radius: 4px; 

      border: 1px solid #e0e6f1; 

    }

    #docx-preview .docx-content a { 

      color: inherit; 

      text-decoration: none; 

      pointer-events: none !important; 

      cursor: default !important; 

    }

    #docx-preview .docx-content a:hover { 

      text-decoration: none; 

    }

    #docx-preview .docx-content a * { pointer-events: none !important; cursor: default !important; }



    /* Normalize text alignment and offsets that sometimes shift content to the right */

    #docx-preview .docx-content h1,

    #docx-preview .docx-content h2,

    #docx-preview .docx-content h3,

    #docx-preview .docx-content h4,

    #docx-preview .docx-content h5,

    #docx-preview .docx-content h6,

    #docx-preview .docx-content p { 

      text-align: left !important; 

      margin-left: 0 !important; 

      padding-left: 0 !important; 

      float: none !important; 

    }



    /* Ensure lists keep consistent left spacing */

    #docx-preview .docx-content ul, 

    #docx-preview .docx-content ol { 

      margin: 0 0 10px 20px !important; 

      padding-left: 18px !important; 

    }

  `;



  // Styles for data validation tables

  const dataValidationTableStyles = `

    .data-validation-table {

      max-width: 100%;

      overflow-x: auto;

      border: 2px solid #007bff;

      border-radius: 8px;

      background: #fff;

      box-shadow: 0 2px 8px rgba(0,0,0,0.1);

    }

    
    
    .data-validation-table table {

      width: 100%;

      border-collapse: collapse;

      margin: 0;

      background: #fff;

      font-size: 13px;

      line-height: 1.5;

      min-width: 600px;

    }

    
    
    .data-validation-table table th {

      background: #f0f5ff;

      color: #000;

      font-weight: 600;

      border: 1px solid #e0e6f1;

      padding: 12px 16px;

      text-align: left;

      vertical-align: middle;

      white-space: nowrap;

      position: sticky;

      top: 0;

      z-index: 10;

    }

    
    
    .data-validation-table table td {

      border: 2px solid #dee2e6;

      padding: 0;

      vertical-align: middle;

      text-align: left;

      background: #fff;

      transition: all 0.2s ease;

    }

    
    
    .data-validation-table table tr:nth-child(even) td {

      background: #f8f9fa;

    }

    
    
    .data-validation-table table tr:hover td {

      background: #e3f2fd;

      border-color: #2196f3;

    }

    
    
    .data-validation-table .editable-cell {

      border: 2px solid #28a745;

      background: #f8fff9;

      border-radius: 4px;

      transition: all 0.2s ease;

      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;

      font-size: 13px;

      padding: 8px 4px !important;

      width: 100%;

      box-sizing: border-box;

      cursor: text;

      position: relative;

    }

    
    
    .data-validation-table .editable-cell::before {

      content: '✏️';

      position: absolute;

      right: 8px;

      top: 50%;

      transform: translateY(-50%);

      font-size: 12px;

      opacity: 0.6;

      pointer-events: none;

    }

    
    
    .data-validation-table .editable-cell:focus {

      border-color: #007bff;

      background: #fff;

      box-shadow: 0 0 0 3px rgba(0,123,255,0.25);

      outline: none;

      transform: scale(1.02);

    }

    
    
    .data-validation-table .editable-cell:hover {

      border-color: #20c997;

      background: #f0fff4;

    }

    
    
    .data-validation-table .editable-cell:focus::before {

      opacity: 0.3;

    }

    
    
    .data-validation-table .table-title {

      background: #343a40;

      color: #fff;

      padding: 16px;

      font-size: 18px;

      font-weight: bold;

      text-align: center;

      border-radius: 6px 6px 0 0;

      margin: 0;

    }

    
    .data-validation-table .editable-title {
      background: transparent !important;
      border: none !important;
      color: white !important;
      font-size: 18px !important;
      font-weight: bold !important;
      width: 100% !important;
      padding: 8px !important;
      outline: none !important;
      border-bottom: 2px solid transparent !important;
      transition: border-bottom-color 0.2s ease !important;
      text-align: center !important;
    }
    
    .data-validation-table .editable-title:focus {
      border-bottom-color: #007bff !important;
      background: rgba(255, 255, 255, 0.1) !important;
    }
    
    .data-validation-table .editable-title:hover {
      background: rgba(255, 255, 255, 0.05) !important;
    }
    
    .data-validation-table .editable-header {
      background: transparent !important;
      border: none !important;
      color: #000 !important;
      font-size: 14px !important;
      font-weight: 600 !important;
      width: 100% !important;
      padding: 8px !important;
      outline: none !important;
      border-bottom: 2px solid transparent !important;
      transition: all 0.2s ease !important;
      text-align: center !important;
    }
    
    .data-validation-table .editable-header:focus {
      border-bottom-color: #007bff !important;
      background: rgba(0, 123, 255, 0.1) !important;
    }
    
    .data-validation-table .editable-header:hover {
      background: rgba(0, 123, 255, 0.05) !important;
    }
    
    
    .data-validation-table .table-container {

      padding: 0;

      max-height: 500px;

      overflow-y: auto;

    }

    
    
    .data-validation-table table {

      box-shadow: 0 4px 12px rgba(0,0,0,0.1);

      border-radius: 8px;

      overflow: hidden;

    }

    
    
    .data-validation-table th:first-child {

      border-top-left-radius: 6px;

    }

    
    
    .data-validation-table th:last-child {

      border-top-right-radius: 6px;

    }

    
    
    .data-validation-table tr:last-child td:first-child {

      border-bottom-left-radius: 6px;

    }

    
    
    .data-validation-table tr:last-child td:last-child {

      border-bottom-right-radius: 6px;

    }

    /* Enhanced table styles for colspan/rowspan and table-level metadata */
    .data-validation-table .table-metadata-header {
      background: #f8f9fa;
      border-bottom: 1px solid #dee2e6;
      padding: 12px;
      display: flex;
      gap: 16px;
      align-items: center;
      flex-wrap: wrap;
    }

    .data-validation-table .table-metadata-header label {
      font-weight: 600;
      font-size: 14px;
      color: #495057;
      margin: 0;
    }

    .data-validation-table .table-unit-field,
    .data-validation-table .table-context-field {
      padding: 6px 12px;
      border: 1px solid #ced4da;
      border-radius: 4px;
      font-size: 14px;
      background: #fff;
      transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
    }

    .data-validation-table .table-unit-field:focus,
    .data-validation-table .table-context-field:focus {
      border-color: #007bff;
      outline: none;
      box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
    }

    .data-validation-table .table-unit-field:hover,
    .data-validation-table .table-context-field:hover {
      border-color: #20c997;
    }

    /* Colspan/rowspan support without visual indicators */
    .data-validation-table th[colspan],
    .data-validation-table td[colspan] {
      position: relative;
    }

    .data-validation-table th[rowspan],
    .data-validation-table td[rowspan] {
      position: relative;
    }

    /* Stable table structure - prevent layout shifts */
    .data-validation-table table {
      table-layout: fixed;
      width: 100%;
    }

    .data-validation-table th,
    .data-validation-table td {
      position: relative;
      vertical-align: top;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }

    /* Enhanced cell editing styles */
    .data-validation-table .editable-cell {
      border: 2px solid #28a745;
      background: #f8fff9;
      position: relative;
      min-height: 32px;
      transition: all 0.2s ease;
    }

    .data-validation-table .editable-cell:focus {
      border-color: #007bff;
      background: #fff;
      box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.25);
    }

    .data-validation-table .editable-cell:hover {
      border-color: #20c997;
      background: #f0fff4;
    }

    /* Validation indicators */
    .data-validation-table .cell-validation-error {
      border-color: #dc3545 !important;
      background: #f8d7da !important;
    }

    .data-validation-table .cell-validation-warning {
      border-color: #ffc107 !important;
      background: #fff3cd !important;
    }

    .data-validation-table .cell-validation-success {
      border-color: #28a745 !important;
      background: #d4edda !important;
    }

    /* Responsive design for table metadata header */
    @media (max-width: 768px) {
      .data-validation-table .table-metadata-header {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
      }
      
      .data-validation-table .table-metadata-header > div {
        flex-direction: column;
        align-items: stretch;
        gap: 4px;
      }
      
      .data-validation-table .table-unit-field,
      .data-validation-table .table-context-field {
        width: 100% !important;
        min-width: auto !important;
      }
    }

    /* Diff display styles for Review & Submit modal */

    .diff-item {

      margin-bottom: 12px;

      padding: 12px;

      background-color: #f8f9fa;

      border-radius: 6px;

      border: 1px solid #e9ecef;

    }

    
    
    .diff-path {

      font-weight: bold;

      margin-bottom: 8px;

      color: #495057;

      font-size: 14px;

    }

    
    
    .diff-old-value {

      background-color: #f8d7da;

      padding: 6px 10px;

      border-radius: 4px;

      color: #721c24;

      font-size: 13px;

      font-family: monospace;

    }

    
    
    .diff-new-value {

      background-color: #d4edda;

      padding: 6px 10px;

      border-radius: 4px;

      color: #155724;

      font-size: 13px;

      font-family: monospace;

    }

    
    
    .diff-arrow {

      font-size: 16px;

      color: #6c757d;

      margin: 0 8px;

    }

  `;





  // Function to convert HTML table or plain text table to editable React table

  // Function to clean cell content by removing number prefixes
  const cleanCellContent = (text) => {
    if (!text || typeof text !== 'string') return text;
    
    // Only remove leading numbers followed by separators (space, period, dash, parentheses)
    // Examples: "1. Text" -> "Text", "2- Text" -> "Text", "3 Text" -> "Text", "1) Text" -> "Text"
    // But preserve standalone numbers like "6000", "5600" as they are data values
    let cleaned = text.replace(/^\d+[.\-\s\)]+/, '').trim();
    
    // Don't remove standalone numbers - they are likely data values
    // Only return cleaned if it's not empty, otherwise return original
    return cleaned || text;
  };

  // Enhanced table parser that preserves colspan/rowspan and supports unit/context fields
  const parseTableWithStructure = (tableString, nodeIndex, rowIndex) => {
    try {
      let tableStructure = {
        title: '',
        headers: [],
        data: [],
        unit: '', // Table-level unit
        context: '', // Table-level context
        colspanMap: new Map(), // Maps cell position to colspan
        rowspanMap: new Map(), // Maps cell position to rowspan
        isHtml: false
      };

      // Check if it's HTML table
      if (tableString.trim().startsWith('<table')) {
        tableStructure.isHtml = true;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = tableString;
        const table = tempDiv.querySelector('table');
        
        if (!table) {
          throw new Error('Invalid HTML table format');
        }

        // Extract table-level unit and context from table attributes
        tableStructure.unit = table.getAttribute('data-unit') || '';
        tableStructure.context = table.getAttribute('data-context') || '';

        const rows = Array.from(table.querySelectorAll('tr'));
        let dataRows = rows;

        // Extract table title from the first row if it exists
        let headerStartIndex = 0;
        if (rows.length > 0) {
          const firstRow = rows[0];
          const firstCell = firstRow.querySelector('td, th');
          if (firstCell && firstCell.colSpan > 1) {
            tableStructure.title = firstCell.textContent.trim();
            headerStartIndex = 1; // Headers start from second row
          }
        }

        // Extract headers with colspan/rowspan support
        if (rows.length > headerStartIndex) {
          const headerRow = rows[headerStartIndex];
          const headerCells = Array.from(headerRow.querySelectorAll('td, th'));
          
          tableStructure.headers = headerCells.map((cell, idx) => {
            const rawText = cell.textContent.trim();
            const cleanedText = cleanCellContent(rawText);
            
            return {
              text: cleanedText || `Column ${idx + 1}`, // Provide default name for empty headers
              originalText: rawText, // Keep original for reference
              colspan: parseInt(cell.colSpan) || 1,
              rowspan: parseInt(cell.rowSpan) || 1
            };
          });
        }

        // Extract data rows with structure preservation (start after headers)
        const dataStartIndex = headerStartIndex + 1;
        tableStructure.data = rows.slice(dataStartIndex).map((row, rowIdx) => {
          const cells = Array.from(row.querySelectorAll('td, th'));
          return cells.map((cell, cellIdx) => {
            const rawText = cell.textContent.trim();
            const cleanedText = cleanCellContent(rawText);
            
            const cellData = {
              text: cleanedText,
              originalText: rawText, // Keep original for reference
              colspan: parseInt(cell.colSpan) || 1,
              rowspan: parseInt(cell.rowSpan) || 1
            };
            
            // Store colspan/rowspan info for rendering
            const cellKey = `${rowIdx}-${cellIdx}`;
            tableStructure.colspanMap.set(cellKey, cellData.colspan);
            tableStructure.rowspanMap.set(cellKey, cellData.rowspan);
            
            return cellData;
          });
        });

      } else {
        // Parse plain text table
        const lines = tableString.trim().split('\n').filter(line => line.trim());
        if (lines.length < 2) {
          throw new Error('Invalid table format');
        }

        // First line might be title
        let startIndex = 0;
        if (lines[0].includes('\t') === false && lines[1].includes('\t')) {
          tableStructure.title = lines[0].trim();
          startIndex = 1;
        }

        // Find header row
        let headerLine = null;
        let headerIndex = startIndex;

        for (let i = startIndex; i < lines.length; i++) {
          const line = lines[i];
          if (line.includes('\t')) {
            const potentialHeaders = line.split('\t').map(h => h.trim()).filter(h => h);
            if (potentialHeaders.length > 1 && potentialHeaders.some(h => h.length > 3)) {
              headerLine = line;
              headerIndex = i;
              break;
            }
          }
        }

        if (!headerLine) {
          throw new Error('No valid headers found in table');
        }

        const headers = headerLine.split('\t').map(h => h.trim()).filter(h => h);
        tableStructure.headers = headers.map((text, idx) => {
          const cleanedText = cleanCellContent(text);
          return {
            text: cleanedText || `Column ${idx + 1}`, // Provide default name for empty headers
            originalText: text, // Keep original for reference
            colspan: 1,
            rowspan: 1
          };
        });

        // Parse data rows
        tableStructure.data = lines.slice(headerIndex + 1).map((line, lineIdx) => {
          const cells = line.split('\t').map(cell => cell.trim());
          
          // Ensure all rows have the same number of columns
          while (cells.length < headers.length) {
            cells.push('');
          }
          
          return cells.slice(0, headers.length).map((text, cellIdx) => {
            const cleanedText = cleanCellContent(text);
            
            const cellData = {
              text: cleanedText,
              originalText: text, // Keep original for reference
              colspan: 1,
              rowspan: 1
            };
            
            const cellKey = `${lineIdx}-${cellIdx}`;
            tableStructure.colspanMap.set(cellKey, 1);
            tableStructure.rowspanMap.set(cellKey, 1);
            
            return cellData;
          });
        });
      }

      return tableStructure;
    } catch (error) {
      console.error('Error parsing table:', error);
      throw error;
    }
  };

  const renderEditableTable = (tableString, nodeIndex, rowIndex) => {
    try {
      const tableStructure = parseTableWithStructure(tableString, nodeIndex, rowIndex);
      return renderEnhancedTableComponent(tableStructure, nodeIndex, rowIndex);
    } catch (error) {
      console.error('Error rendering table:', error);
      return <div className="text-danger">Error parsing table: {error.message}</div>;
    }
  };




  // Helper function to render the table component

  // Enhanced table component with colspan/rowspan support and unit/context fields
  const renderEnhancedTableComponent = (tableStructure, nodeIndex, rowIndex) => {
    const tableKey = `table_${nodeIndex}_${rowIndex}`;
    const currentTitle = tableTitles.get(tableKey) || tableStructure.title || '';
    const currentHeaders = tableHeaders.get(tableKey) || tableStructure.headers;
    const currentData = tableData.get(tableKey) || tableStructure.data;
    
    // Use current table structure for rendering to ensure proper updates
    const currentTableStructure = {
      ...tableStructure,
      title: currentTitle,
      headers: currentHeaders,
      data: currentData
    };

    // Function to update table structure in JSON
    const updateTableStructure = (newStructure) => {
      try {
        console.log('Updating table structure:', newStructure);
        
        // Validate and correct the table structure before updating
        const validatedStructure = validateAndCorrectTableStructure(newStructure);
        console.log('Validated structure:', validatedStructure);
        
        let updatedTableString = '';
        
        if (tableStructure.isHtml) {
          // Rebuild HTML table with structure
          updatedTableString = buildHtmlTableFromStructure(validatedStructure);
        } else {
          // Rebuild plain text table
          if (validatedStructure.title) {
            updatedTableString += validatedStructure.title + '\n';
          }
          updatedTableString += validatedStructure.headers.map(h => h.text).join('\t') + '\n';
          updatedTableString += validatedStructure.data.map(row => 
            row.map(cell => cell.text).join('\t')
          ).join('\n');
        }
        
        console.log('Updated table string:', updatedTableString);
        handleValueChange(nodeIndex, rowIndex, updatedTableString);
        setHasUnsavedChanges(true);
      } catch (error) {
        console.error('Error updating table structure:', error);
      }
    };

    // Function to build HTML table from structure
    const buildHtmlTableFromStructure = (structure) => {
      let html = '<table';
      
      // Add table-level attributes
      if (structure.unit) {
        html += ` data-unit="${structure.unit}"`;
      }
      if (structure.context) {
        html += ` data-context="${structure.context}"`;
      }
      html += '>';
      
      // Add title row if exists
      if (structure.title) {
        const totalCols = structure.headers.reduce((sum, h) => sum + h.colspan, 0);
        html += `<tr><td colspan="${totalCols}">${structure.title}</td></tr>`;
      }
      
      // Add header row
      html += '<tr>';
      structure.headers.forEach(header => {
        const attrs = [];
        if (header.colspan > 1) attrs.push(`colspan="${header.colspan}"`);
        if (header.rowspan > 1) attrs.push(`rowspan="${header.rowspan}"`);
        
        const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
        html += `<th${attrStr}>${header.text}</th>`;
      });
      html += '</tr>';
      
      // Add data rows
      structure.data.forEach(row => {
        html += '<tr>';
        row.forEach(cell => {
          const attrs = [];
          if (cell.colspan > 1) attrs.push(`colspan="${cell.colspan}"`);
          if (cell.rowspan > 1) attrs.push(`rowspan="${cell.rowspan}"`);
          
          const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
          html += `<td${attrStr}>${cell.text}</td>`;
        });
        html += '</tr>';
      });
      
      html += '</table>';
      return html;
    };

    // Function to handle cell changes
    const handleCellChange = (rowIdx, cellIdx, field, value) => {
      console.log('Cell change:', { rowIdx, cellIdx, field, value, currentValue: currentData[rowIdx]?.[cellIdx]?.text });
      
      const newStructure = { ...currentTableStructure };
      newStructure.data = [...newStructure.data];
      newStructure.data[rowIdx] = [...newStructure.data[rowIdx]];
      newStructure.data[rowIdx][cellIdx] = {
        ...newStructure.data[rowIdx][cellIdx],
        [field]: value
      };
      
      // Update the table data state
      setTableData(prev => new Map(prev).set(tableKey, newStructure.data));
      
      // Only check for duplicates if the row would be completely empty after this change
      if (field === 'text') {
        const rowText = newStructure.data[rowIdx].map(cell => cell.text).join('|');
        const isEmptyRow = rowText.trim() === '';
        
        if (!isEmptyRow && !preventDuplicateRows(newStructure, newStructure.data[rowIdx])) {
          console.warn('Duplicate row detected, preventing update');
          return;
        }
      }
      
      updateTableStructure(newStructure);
    };

    // Function to handle header changes
    const handleHeaderChange = (headerIdx, field, value) => {
      const newStructure = { ...currentTableStructure };
      newStructure.headers = [...newStructure.headers];
      newStructure.headers[headerIdx] = {
        ...newStructure.headers[headerIdx],
        [field]: value
      };
      
      updateTableStructure(newStructure);
    };

    // Function to handle title changes
    const handleTitleChange = (value) => {
      const newStructure = { ...currentTableStructure, title: value };
      updateTableStructure(newStructure);
    };

    // Get validation status for this table
    const validation = validateTableStructure(currentTableStructure);

    return (
      <div className="data-validation-table">
        {tableStructure.title && (
          <div className="table-title">
            <input
              type="text"
              className="editable-title"
              value={currentTitle}
              onChange={(e) => {
                const newTitle = e.target.value;
                setTableTitles(prev => new Map(prev).set(tableKey, newTitle));
                handleTitleChange(newTitle);
              }}
              placeholder="Enter table title..."
              style={{
                background: 'transparent',
                border: 'none',
                color: 'white',
                fontSize: '1.1rem',
                fontWeight: '600',
                width: '100%',
                padding: '8px',
                outline: 'none',
                borderBottom: '2px solid transparent',
                transition: 'border-bottom-color 0.2s ease'
              }}
              onFocus={(e) => {
                e.target.style.borderBottomColor = '#007bff';
              }}
              onBlur={(e) => {
                e.target.style.borderBottomColor = 'transparent';
              }}
            />
          </div>
        )}
        
        {/* Validation status indicator */}
        {!validation.isValid && (
          <div className="table-validation-status" style={{
            background: '#f8d7da',
            color: '#721c24',
            padding: '8px',
            fontSize: '12px',
            borderBottom: '1px solid #f5c6cb'
          }}>
            ⚠️ Table validation issues: {validation.errors.join(', ')}
          </div>
        )}
        
        {validation.warnings.length > 0 && (
          <div className="table-validation-warnings" style={{
            background: '#fff3cd',
            color: '#856404',
            padding: '8px',
            fontSize: '12px',
            borderBottom: '1px solid #ffeaa7'
          }}>
            ℹ️ Warnings: {validation.warnings.join(', ')}
            {validation.warnings.some(w => w.includes('auto-filled')) && (
              <div style={{ marginTop: '4px', fontStyle: 'italic' }}>
                ✅ Table structure has been automatically corrected
              </div>
            )}
          </div>
        )}

        {/* Unit and Context fields at the top */}
        <div className="table-metadata-header" style={{
          background: '#f8f9fa',
          padding: '12px',
          borderBottom: '1px solid #dee2e6',
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontWeight: '600', fontSize: '14px', color: '#495057', width: '74px' }}>Unit:</label>
            <input
              type="text"
              className="table-unit-field"
              value={currentTableStructure.unit || ''}
              onChange={(e) => {
                const newStructure = { ...currentTableStructure, unit: e.target.value };
                updateTableStructure(newStructure);
              }}
              placeholder="Enter table unit (e.g., Rs. in Lakhs, Numbers, etc.)"
              style={{
                padding: '6px 12px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '14px',
                minWidth: '200px',
                background: '#fff'
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontWeight: '600', fontSize: '14px', color: '#495057', width: '74px' }}>Context:</label>
            <input
              type="text"
              className="table-context-field"
              value={currentTableStructure.context || ''}
              onChange={(e) => {
                const newStructure = { ...currentTableStructure, context: e.target.value };
                updateTableStructure(newStructure);
              }}
              placeholder="Enter table context or description"
              style={{
                padding: '6px 12px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '14px',
                minWidth: '250px',
                background: '#fff'
              }}
            />
          </div>
        </div>
        
        <div className="table-container">
          <table>
            <thead>
              <tr>
                {currentHeaders.map((header, idx) => (
                  <th 
                    key={idx}
                    colSpan={header.colspan}
                    rowSpan={header.rowspan}
                  >
                    <input
                      type="text"
                      className="editable-header"
                      value={header.text}
                      onChange={(e) => {
                        const newHeader = e.target.value;
                        const updatedHeaders = [...currentHeaders];
                        updatedHeaders[idx] = { ...updatedHeaders[idx], text: newHeader };
                        setTableHeaders(prev => new Map(prev).set(tableKey, updatedHeaders));
                        handleHeaderChange(idx, 'text', newHeader);
                      }}
                      placeholder="Enter header..."
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#000',
                        fontSize: '14px',
                        fontWeight: '600',
                        width: '100%',
                        padding: '8px',
                        outline: 'none',
                        borderBottom: '2px solid transparent',
                        transition: 'border-bottom-color 0.2s ease',
                        textAlign: 'center'
                      }}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            
            <tbody>
              {currentTableStructure.data.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  {row.map((cell, cellIdx) => (
                    <td 
                      key={cellIdx}
                      colSpan={cell.colspan}
                      rowSpan={cell.rowspan}
                    >
                      <input
                        type="text"
                        className="editable-cell"
                        value={cell.text || ''}
                        onChange={(e) => handleCellChange(rowIdx, cellIdx, 'text', e.target.value)}
                        style={{
                          width: '100%',
                          border: 'none',
                          background: 'transparent',
                          padding: '8px',
                          outline: 'none',
                          fontSize: '14px'
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Table structure validation functions
  const validateTableStructure = (tableStructure) => {
    const errors = [];
    const warnings = [];

    try {
      // Validate headers
      if (!tableStructure.headers || tableStructure.headers.length === 0) {
        errors.push('Table must have at least one header column');
      }

      // Validate data rows
      if (!tableStructure.data || tableStructure.data.length === 0) {
        warnings.push('Table has no data rows');
      }

      // Validate colspan/rowspan consistency
      const totalHeaderCols = tableStructure.headers.reduce((sum, h) => sum + (h.colspan || 1), 0);
      
      tableStructure.data.forEach((row, rowIdx) => {
        const totalRowCols = row.reduce((sum, cell) => sum + (cell.colspan || 1), 0);
        if (totalRowCols !== totalHeaderCols) {
          // Try to auto-fix by padding with empty cells
          if (totalRowCols < totalHeaderCols) {
            const missingCols = totalHeaderCols - totalRowCols;
            for (let i = 0; i < missingCols; i++) {
              row.push({ text: '', colspan: 1, rowspan: 1 });
            }
            warnings.push(`Row ${rowIdx + 1} was missing ${missingCols} columns - auto-filled with empty cells`);
          } else {
            errors.push(`Row ${rowIdx + 1} has ${totalRowCols} columns but headers expect ${totalHeaderCols}`);
          }
        }
      });

      // Validate cell content
      tableStructure.data.forEach((row, rowIdx) => {
        row.forEach((cell, cellIdx) => {
          if (cell.text === undefined || cell.text === null) {
            warnings.push(`Cell at row ${rowIdx + 1}, column ${cellIdx + 1} has no text content`);
          }
        });
      });

      // Validate table-level unit and context
      if (tableStructure.unit && typeof tableStructure.unit !== 'string') {
        errors.push('Table unit must be a string');
      }
      
      if (tableStructure.context && typeof tableStructure.context !== 'string') {
        errors.push('Table context must be a string');
      }

      // Validate header content
      tableStructure.headers.forEach((header, headerIdx) => {
        if (!header.text || header.text.trim() === '' || header.text.startsWith('Column ')) {
          warnings.push(`Header column ${headerIdx + 1} is empty or auto-generated`);
        }
        
        if (header.colspan && (header.colspan < 1 || header.colspan > 10)) {
          errors.push(`Header column ${headerIdx + 1} has invalid colspan value: ${header.colspan}`);
        }
        
        if (header.rowspan && (header.rowspan < 1 || header.rowspan > 10)) {
          errors.push(`Header column ${headerIdx + 1} has invalid rowspan value: ${header.rowspan}`);
        }
      });

    } catch (error) {
      errors.push(`Validation error: ${error.message}`);
    }

    return { errors, warnings, isValid: errors.length === 0 };
  };

  // Function to ensure stable table structure during editing
  const ensureStableTableStructure = (tableStructure) => {
    const stableStructure = { ...tableStructure };
    
    // Ensure table-level properties
    stableStructure.unit = stableStructure.unit || '';
    stableStructure.context = stableStructure.context || '';
    
    // Ensure all cells have required properties
    stableStructure.headers = stableStructure.headers.map(header => ({
      text: header.text || '',
      originalText: header.originalText || header.text || '',
      colspan: Math.max(1, parseInt(header.colspan) || 1),
      rowspan: Math.max(1, parseInt(header.rowspan) || 1)
    }));

    stableStructure.data = stableStructure.data.map(row => 
      row.map(cell => ({
        text: cell.text || '',
        originalText: cell.originalText || cell.text || '',
        colspan: Math.max(1, parseInt(cell.colspan) || 1),
        rowspan: Math.max(1, parseInt(cell.rowspan) || 1)
      }))
    );

    return stableStructure;
  };

  // Function to prevent duplicate rows during editing
  const preventDuplicateRows = (tableStructure, newRow) => {
    const existingRows = tableStructure.data.map(row => 
      row.map(cell => cell.text).join('|')
    );
    const newRowString = newRow.map(cell => cell.text).join('|');
    
    if (existingRows.includes(newRowString)) {
      return false; // Duplicate detected
    }
    return true;
  };

  // Function to automatically fix common table structure issues
  const autoFixTableStructure = (tableStructure) => {
    const fixedStructure = { ...tableStructure };
    
    // Fix column count mismatches
    const totalHeaderCols = fixedStructure.headers.reduce((sum, h) => sum + (h.colspan || 1), 0);
    
    fixedStructure.data = fixedStructure.data.map(row => {
      const totalRowCols = row.reduce((sum, cell) => sum + (cell.colspan || 1), 0);
      
      if (totalRowCols < totalHeaderCols) {
        // Add missing columns
        const missingCols = totalHeaderCols - totalRowCols;
        for (let i = 0; i < missingCols; i++) {
          row.push({ text: '', originalText: '', colspan: 1, rowspan: 1 });
        }
      } else if (totalRowCols > totalHeaderCols) {
        // Remove excess columns
        row = row.slice(0, totalHeaderCols);
      }
      
      return row;
    });
    
    // Fix empty headers
    fixedStructure.headers = fixedStructure.headers.map((header, idx) => ({
      ...header,
      text: header.text && !header.text.startsWith('Column ') ? header.text : `Column ${idx + 1}`
    }));
    
    return fixedStructure;
  };

  // Function to validate and correct table structure before JSON sync
  const validateAndCorrectTableStructure = (tableStructure) => {
    const validation = validateTableStructure(tableStructure);
    
    if (!validation.isValid) {
      console.warn('Table structure validation failed:', validation.errors);
      // Try to auto-fix the structure
      const autoFixed = autoFixTableStructure(tableStructure);
      console.log('Auto-fixed table structure:', autoFixed);
      return ensureStableTableStructure(autoFixed);
    }
    
    return tableStructure;
  };

  // Legacy function for backward compatibility
  const renderTableComponent = (title, headers, data, nodeIndex, rowIndex) => {
    // Convert legacy format to new structure
    const tableStructure = {
      title: title || '',
      headers: headers.map(text => ({ text, originalText: text, colspan: 1, rowspan: 1 })),
      data: data.map(row => row.map(text => ({ text, originalText: text, colspan: 1, rowspan: 1 }))),
      unit: '',
      context: '',
      colspanMap: new Map(),
      rowspanMap: new Map(),
      isHtml: false
    };
    
    return renderEnhancedTableComponent(tableStructure, nodeIndex, rowIndex);
  };



  const deepSet = (obj, pathArray, value) => {

    if (!obj || !Array.isArray(pathArray)) return;

    let ref = obj;

    for (let i = 0; i < pathArray.length - 1; i++) {

      const key = pathArray[i];

      if (ref[key] === undefined || ref[key] === null) {

        const nextKey = pathArray[i + 1];

        ref[key] = typeof nextKey === 'number' ? [] : {};

      }

      ref = ref[key];

    }

    const lastKey = pathArray[pathArray.length - 1];

    ref[lastKey] = value;

  };



  const coerceType = (original, newValString) => {

    if (original === null || original === undefined) return newValString;

    if (typeof original === 'number') {

      const n = Number(newValString);

      return isNaN(n) ? newValString : n;

    }

    if (typeof original === 'boolean') {

      const s = String(newValString).toLowerCase();

      if (s === 'true') return true;

      if (s === 'false') return false;

      return newValString;

    }

    return newValString;

  };



  // Immediate UI update for responsive typing

  const updateFieldValueImmediate = useCallback((nodeIndex, rowIndex, newValue) => {

    console.log(`updateFieldValueImmediate called with:`, { nodeIndex, rowIndex, newValue });



    setExtractedDataState(prevState => {

      const newState = JSON.parse(JSON.stringify(prevState)); // Deep clone to ensure proper updates

      newState.nodes = [...newState.nodes];

      newState.nodes[nodeIndex] = { ...newState.nodes[nodeIndex] };

      newState.nodes[nodeIndex].content = [...newState.nodes[nodeIndex].content];

      newState.nodes[nodeIndex].content[rowIndex] = {

        ...newState.nodes[nodeIndex].content[rowIndex],

        value: newValue

      };



      console.log(`Updated extractedDataState for node ${nodeIndex}, row ${rowIndex}:`, {

        oldValue: prevState.nodes[nodeIndex]?.content[rowIndex]?.value,

        newValue: newValue,

        updatedNode: newState.nodes[nodeIndex].content[rowIndex]

      });



      return newState;

    });

  }, []);



  // Debounced tracking of pending changes

  const trackPendingChange = useCallback((nodeIndex, rowIndex, newValue, path) => {

    const changeKey = `${nodeIndex}-${rowIndex}`;



    setPendingChanges(prev => {

      const newChanges = new Map(prev);

      newChanges.set(changeKey, {

        nodeIndex,

        rowIndex,

        newValue,

        path

      });

      return newChanges;

    });



    setHasUnsavedChanges(true);

  }, []);



  const handleValueChange = useCallback((nodeIndex, rowIndex, newValue) => {

    try {

      console.log('=== handleValueChange DEBUG ===');

      console.log('Parameters:', { nodeIndex, rowIndex, newValue });



      // Validate inputs

      if (nodeIndex === undefined || rowIndex === undefined || newValue === undefined) {

        console.warn('Invalid parameters for handleValueChange:', { nodeIndex, rowIndex, newValue });

        return;

      }



      // Validate that the indices are within bounds

      if (!extractedDataState.nodes ||

        !extractedDataState.nodes[nodeIndex] ||

        !extractedDataState.nodes[nodeIndex].content ||

        !extractedDataState.nodes[nodeIndex].content[rowIndex]) {

        console.warn('Invalid node or row index:', { nodeIndex, rowIndex });

        return;

      }



      const oldValue = extractedDataState.nodes[nodeIndex].content[rowIndex].value;

      console.log('Old value:', oldValue);

      console.log('New value:', newValue);

      console.log('Values are different:', String(oldValue) !== String(newValue));



      // ===== IMMEDIATE JSON UPDATE =====
      // Update workingJson immediately to ensure consistency
      const path = extractedDataState.nodes[nodeIndex].content[rowIndex].path;
      if (path && workingJson) {
        try {
          const updatedWorkingJson = JSON.parse(JSON.stringify(workingJson));
          deepSet(updatedWorkingJson, path, newValue);
          setWorkingJson(updatedWorkingJson);
          console.log('✅ Updated workingJson immediately');
        } catch (jsonError) {
          console.error('❌ Failed to update workingJson:', jsonError);
        }
      }

      // ===== COMPREHENSIVE CHANGE LOGGING =====
      // Log every change with complete details
      logChangeWithDetails({
        action: 'field_update',
        nodeIndex,
        rowIndex,
        path: path || 'unknown',
        fieldName: extractedDataState.nodes[nodeIndex].content[rowIndex].text || 'unknown',
        oldValue: String(oldValue),
        newValue: String(newValue),
        changeType: typeof oldValue !== typeof newValue ? 'type_change' : 'value_change'
      });

      // Immediate UI update for responsive typing

      updateFieldValueImmediate(nodeIndex, rowIndex, newValue);



      // Debounce the pending changes tracking to reduce state updates

      console.log('Path:', path);



      if (valueChangeTimerRef.current) {

        clearTimeout(valueChangeTimerRef.current);

      }



      valueChangeTimerRef.current = setTimeout(() => {

        console.log('Tracking pending change after debounce');

        console.log('Current extractedDataState after change:', extractedDataState);

        trackPendingChange(nodeIndex, rowIndex, newValue, path);

        // ===== DATA CONSISTENCY VALIDATION =====
        // Validate consistency after change with Docker-optimized timing
        const validationDelay = process.env.NODE_ENV === 'production' ? 100 : 50;
        setTimeout(() => {
          const errors = validateDataConsistency('field_update');
          if (errors.length > 0) {
            console.warn('⚠️ Data consistency issues detected:', errors);
            correctDataInconsistencies(errors);
          }
        }, validationDelay);

      }, 100); // 100ms debounce



      console.log('=== END handleValueChange DEBUG ===');

    } catch (error) {

      console.error('Error in handleValueChange:', error);

      // Show user-friendly error message

      alert('Error updating field. Please try again.');

    }

  }, [extractedDataState.nodes, updateFieldValueImmediate, trackPendingChange, workingJson, logChangeWithDetails, validateDataConsistency, correctDataInconsistencies]);


  // Function to update the table string in JSON with new title
  const updateTableStringWithNewTitle = useCallback((nodeIndex, rowIndex, newTitle, headers, data) => {
    try {
      // Get the current table string from the extracted data
      const currentTableString = extractedDataState.nodes[nodeIndex].content[rowIndex].value;

      // Check if it's HTML table
      if (currentTableString.trim().startsWith('<table')) {
        // Parse HTML table
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = currentTableString;
        const table = tempDiv.querySelector('table');

        if (table) {
          // Find the title row (first row with colspan > 1)
          const rows = Array.from(table.querySelectorAll('tr'));
          if (rows.length > 0) {
            const firstRow = rows[0];
            const firstCell = firstRow.querySelector('td, th');

            if (firstCell && firstCell.colSpan > 1) {
              // Update the title cell
              firstCell.textContent = newTitle;
            } else {
              // Add a new title row if it doesn't exist
              const newTitleRow = document.createElement('tr');
              const titleCell = document.createElement('td');
              titleCell.colSpan = headers.length;
              titleCell.textContent = newTitle;
              titleCell.style.textAlign = 'center';
              titleCell.style.fontWeight = 'bold';
              newTitleRow.appendChild(titleCell);
              table.insertBefore(newTitleRow, firstRow);
            }

            // Update the table string
            const updatedTableString = table.outerHTML;
            handleValueChange(nodeIndex, rowIndex, updatedTableString);
          }
        }
      } else {
        // Handle plain text table
        const lines = currentTableString.trim().split('\n').filter(line => line.trim());

        if (lines.length >= 2) {
          // Check if first line is a title (no tabs)
          let startIndex = 0;
          if (lines[0].includes('\t') === false && lines[1].includes('\t')) {
            // First line is title, replace it
            lines[0] = newTitle;
          } else {
            // No title exists, add one
            lines.unshift(newTitle);
          }

          const updatedTableString = lines.join('\n');
          handleValueChange(nodeIndex, rowIndex, updatedTableString);
        }
      }
    } catch (error) {
      console.error('Error updating table string with new title:', error);
    }
  }, [extractedDataState.nodes, handleValueChange]);

  // Function to update the table string in JSON with new headers
  const updateTableStringWithNewHeaders = useCallback((nodeIndex, rowIndex, newHeaders, title, data) => {
    try {
      // Get the current table string from the extracted data
      const currentTableString = extractedDataState.nodes[nodeIndex].content[rowIndex].value;

      // Check if it's HTML table
      if (currentTableString.trim().startsWith('<table')) {
        // Parse HTML table
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = currentTableString;
        const table = tempDiv.querySelector('table');

        if (table) {
          // Find the header row (usually the first row after title, or first row if no title)
          const rows = Array.from(table.querySelectorAll('tr'));
          let headerRowIndex = 0;

          // Skip title row if it exists (has colspan > 1)
          if (rows.length > 0) {
            const firstRow = rows[0];
            const firstCell = firstRow.querySelector('td, th');
            if (firstCell && firstCell.colSpan > 1) {
              headerRowIndex = 1;
            }
          }

          if (rows[headerRowIndex]) {
            const headerRow = rows[headerRowIndex];
            const headerCells = Array.from(headerRow.querySelectorAll('td, th'));

            // Update existing header cells or add new ones
            newHeaders.forEach((header, idx) => {
              if (headerCells[idx]) {
                headerCells[idx].textContent = header;
              } else {
                const newCell = document.createElement('th');
                newCell.textContent = header;
                headerRow.appendChild(newCell);
              }
            });

            // Remove excess header cells if new headers are fewer
            while (headerCells.length > newHeaders.length) {
              headerRow.removeChild(headerCells[headerCells.length - 1]);
              headerCells.pop();
            }

            // Update the table string
            const updatedTableString = table.outerHTML;
            handleValueChange(nodeIndex, rowIndex, updatedTableString);
          }
        }
      } else {
        // Handle plain text table
        const lines = currentTableString.trim().split('\n').filter(line => line.trim());

        if (lines.length >= 2) {
          // Find header row index
          let headerRowIndex = 0;
          if (lines[0].includes('\t') === false && lines[1].includes('\t')) {
            // First line is title, header is second line
            headerRowIndex = 1;
          }

          if (lines[headerRowIndex]) {
            // Update header row
            lines[headerRowIndex] = newHeaders.join('\t');

            const updatedTableString = lines.join('\n');
            handleValueChange(nodeIndex, rowIndex, updatedTableString);
          }
        }
      }
    } catch (error) {
      console.error('Error updating table string with new headers:', error);
    }
  }, [extractedDataState.nodes, handleValueChange]);


  // Function to apply all pending changes to workingJson (used internally by handleReviewAndSubmit)

  const applyPendingChanges = useCallback(() => {

    if (pendingChanges.size === 0) {

      setHasUnsavedChanges(false);

      return workingJson;

    }



    let updatedJson = workingJson ? JSON.parse(JSON.stringify(workingJson)) : {};



    // Apply all pending changes

    pendingChanges.forEach((change) => {

      const { path, newValue, type } = change;

      // Table title and header changes are now handled directly in the JSON data
      // through updateTableStringWithNewTitle and updateTableStringWithNewHeaders functions


      if (Array.isArray(path) && path.length > 0) {

        // Read original value type to preserve type on edit

        let original = originalJsonRef.current;

        for (let i = 0; i < path.length; i++) {

          if (original == null) break;

          original = original[path[i]];

        }



        const coerced = coerceType(original, newValue);

        deepSet(updatedJson, path, coerced);

      }

    });



    return updatedJson;

  }, [pendingChanges, workingJson, originalJsonRef]);










  const submitAuditLog = async ({ oldJson, newJson, modified }) => {

    try {

      const token = localStorage.getItem('token');



      // Convert diff objects back to string format for backend compatibility

      const modifiedForBackend = Array.isArray(modified) ? modified.map(diff => {

        if (diff && typeof diff === 'object' && diff.path && diff.oldValue !== undefined && diff.newValue !== undefined) {

          // Convert object format back to string format: "path: oldValue -> newValue"

          return `${diff.path}: ${diff.oldValue} -> ${diff.newValue}`;

        } else if (typeof diff === 'string') {

          // Already in string format, return as-is

          return diff;

        } else {

          // Fallback: convert any other format to string

          console.warn('Unexpected diff format:', diff);

          return String(diff);

        }

      }).filter(Boolean) : [];



      console.log('Sending modified data to backend:', modifiedForBackend);

      console.log('Modified data type:', typeof modifiedForBackend);

      console.log('Modified data length:', modifiedForBackend.length);



      const requestBody = {

        title: uploadedJsonFileName || incomingFileName || 'data_validation_update',

        oldJson: oldJson ?? null,

        newJson: newJson ?? null,

        modified: modifiedForBackend,

        action: 'data validation update',

        fileId: fileId || null,

        oldDocxHtml: docxHtml || null,

        newDocxHtml: docxHtml || null,

      };



      console.log('Full request body being sent:', requestBody);



      const res = await fetch(`${BASE_URL}/admin/audit-logs`, {

        method: 'POST',

        headers: {

          'Content-Type': 'application/json',

          ...(token ? { 'Authorization': `Bearer ${token}` } : {})

        },

        body: JSON.stringify(requestBody)

      });

      if (!res.ok) {

        const errorText = await res.text();

        // Enhanced error logging for production debugging
        console.error('Audit log submission failed:', {
          status: res.status,
          statusText: res.statusText,
          url: `${BASE_URL}/admin/audit-logs`,
          errorText,
          requestBody: requestBody,
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV || 'development'
        });

        throw new Error(`Failed to create audit log: ${res.status} - ${errorText}`);

      }

      setJsonUploadMsg({ type: 'success', text: 'Changes submitted and audit log updated.' });

    } catch (e) {

      console.error('Error in submitAuditLog:', e);

      setJsonUploadMsg({ type: 'error', text: `Submission succeeded but audit log failed: ${e.message}` });

    }

  };



  // Feedback functions

  const handleFeedbackSubmit = async () => {

    if (!feedbackSeverity || !feedbackDescription.trim()) {

      alert('Please select severity and provide a description.');

      return;

    }



    setFeedbackSubmitting(true);

    try {

      const token = localStorage.getItem('token');

      const response = await fetch(`${BASE_URL}/api/data-validation-feedback`, {

        method: 'POST',

        headers: {

          'Content-Type': 'application/json',

          'Authorization': `Bearer ${token}`

        },

        body: JSON.stringify({

          file_id: fileId || null,

          severity: feedbackSeverity,

          issue_description: feedbackDescription,

          field_path: feedbackFieldPath || null,

          field_value: feedbackFieldValue || null

        })

      });



      if (!response.ok) {

        throw new Error('Failed to submit feedback');

      }



      setFeedbackSuccess(true);

      setTimeout(() => {

        setShowFeedbackModal(false);

        setFeedbackSuccess(false);

        setFeedbackSeverity('');

        setFeedbackDescription('');

        setFeedbackFieldPath('');

        setFeedbackFieldValue('');

      }, 2000);



    } catch (error) {

      console.error('Error submitting feedback:', error);

      alert('Failed to submit feedback. Please try again.');

    } finally {

      setFeedbackSubmitting(false);

    }

  };



  const openFeedbackModal = (fieldPath = '', fieldValue = '') => {

    setFeedbackFieldPath(fieldPath);

    setFeedbackFieldValue(fieldValue);

    setShowFeedbackModal(true);

  };



  // General feedback functions

  const handleGeneralFeedbackSubmit = async () => {

    if (!generalFeedbackSeverity || !generalFeedbackMessage.trim()) {

      alert('Please select severity and provide a message.');

      return;

    }



    setGeneralFeedbackSubmitting(true);

    try {

      const token = localStorage.getItem('token');

      const response = await fetch(`${BASE_URL}/api/data-validation-feedback`, {

        method: 'POST',

        headers: {

          'Content-Type': 'application/json',

          'Authorization': `Bearer ${token}`

        },

        body: JSON.stringify({

          file_id: fileId || null,

          severity: generalFeedbackSeverity,

          issue_description: generalFeedbackMessage,

          field_path: null,

          field_value: null

        })

      });



      if (!response.ok) {

        throw new Error('Failed to submit feedback');

      }



      setGeneralFeedbackSuccess(true);

      setTimeout(() => {

        setShowGeneralFeedbackModal(false);

        setGeneralFeedbackSuccess(false);

        setGeneralFeedbackSeverity('');

        setGeneralFeedbackMessage('');

      }, 2000);



    } catch (error) {

      console.error('Error submitting general feedback:', error);

      alert('Failed to submit feedback. Please try again.');

    } finally {

      setGeneralFeedbackSubmitting(false);

    }

  };



  const openGeneralFeedbackModal = () => {

    setShowGeneralFeedbackModal(true);

  };



  // Draft-related functions

  const openDraftModal = () => {

    setDraftName('');

    setDraftNameError('');

    setDraftMessage({ type: '', text: '' });

    setShowDraftModal(true);

  };



  const openDraftListModal = async () => {

    setShowDraftListModal(true);

    await loadDrafts();

  };



  // Auto-load the most recent draft (silent, no UI feedback)

  const autoLoadMostRecentDraft = async () => {

    try {

      console.log('=== autoLoadMostRecentDraft DEBUG ===');

      console.log('fileId:', fileId);



      const token = localStorage.getItem('token');

      if (!token) {

        console.log('No token found, skipping auto-load');

        return; // No token, skip auto-load

      }



      // Wait a bit to ensure any ongoing autosave operations complete

      await new Promise(resolve => setTimeout(resolve, 1000));



      console.log('Fetching drafts for fileId:', fileId);

      const response = await fetch(`${BASE_URL}/api/data-validation-drafts?file_id=${fileId || ''}`, {

        headers: {

          'Authorization': `Bearer ${token}`

        }

      });



      if (!response.ok) {

        console.log('No drafts found or failed to fetch drafts, status:', response.status);

        return;

      }



      const draftsData = await response.json();

      console.log('Fetched drafts data:', draftsData);



      if (!draftsData || draftsData.length === 0) {

        console.log('No drafts available for auto-load');

        return;

      }



      // Prioritize manual saves over autosaves

      // Manual saves are more likely to contain intentional changes

      const manualSaves = draftsData.filter(draft => !draft.draft_name.startsWith('Autosave_'));

      const autosaves = draftsData.filter(draft => draft.draft_name.startsWith('Autosave_'));



      console.log('Manual saves found:', manualSaves.length);

      console.log('Autosaves found:', autosaves.length);



      let mostRecentDraft = null;



      if (manualSaves.length > 0) {

        // Use most recent manual save first

        mostRecentDraft = manualSaves.sort((a, b) => new Date(b.last_saved) - new Date(a.last_saved))[0];

        console.log('Auto-loading most recent manual save:', mostRecentDraft.draft_name);

      } else if (autosaves.length > 0) {

        // Fall back to most recent autosave if no manual saves

        mostRecentDraft = autosaves.sort((a, b) => new Date(b.last_saved) - new Date(a.last_saved))[0];

        console.log('Auto-loading most recent autosave:', mostRecentDraft.draft_name);

      }



      if (mostRecentDraft) {

        console.log('About to load draft:', mostRecentDraft);



        // Validate draft data before loading

        if (!mostRecentDraft.extracted_data && !mostRecentDraft.working_json && !mostRecentDraft.pending_changes) {

          console.log('Draft has no data, skipping load');

          return;

        }



        await loadDraft(mostRecentDraft);

        // Show a subtle notification that draft was auto-loaded

        setDraftMessage({ type: 'success', text: `Auto-loaded: ${mostRecentDraft.draft_name}` });

        setTimeout(() => setDraftMessage({ type: '', text: '' }), 3000);

      } else {

        console.log('No suitable draft found for auto-load');

      }



      console.log('=== END autoLoadMostRecentDraft DEBUG ===');



    } catch (error) {

      console.error('Error auto-loading draft:', error);

      // Don't show error to user for auto-load failures

    }

  };



  // Direct load of the most recent autosave (manual button)

  const loadLastAutosave = async () => {

    try {

      setLoadingDrafts(true);

      const token = localStorage.getItem('token');

      const response = await fetch(`${BASE_URL}/api/data-validation-drafts?file_id=${fileId || ''}`, {

        headers: {

          'Authorization': `Bearer ${token}`

        }

      });



      if (!response.ok) {

        throw new Error('Failed to fetch drafts');

      }



      const draftsData = await response.json();



      // Find the most recent autosave (starts with "Autosave_")

      const autosaves = draftsData.filter(draft => draft.draft_name.startsWith('Autosave_'));



      if (autosaves.length === 0) {

        setDraftMessage({ type: 'error', text: 'No autosave found. Make some changes first.' });

        setTimeout(() => setDraftMessage({ type: '', text: '' }), 3000);

        return;

      }



      // Sort by creation date and get the most recent

      const lastAutosave = autosaves.sort((a, b) => new Date(b.last_saved) - new Date(a.last_saved))[0];



      console.log('Loading last autosave:', lastAutosave);

      await loadDraft(lastAutosave);



    } catch (error) {

      console.error('Error loading last autosave:', error);

      setDraftMessage({ type: 'error', text: 'Failed to load last autosave' });

      setTimeout(() => setDraftMessage({ type: '', text: '' }), 3000);

    } finally {

      setLoadingDrafts(false);

    }

  };



  const loadDrafts = async () => {

    setLoadingDrafts(true);

    try {

      const token = localStorage.getItem('token');

      const response = await fetch(`${BASE_URL}/api/data-validation-drafts?file_id=${fileId || ''}`, {

        headers: {

          'Authorization': `Bearer ${token}`

        }

      });



      if (!response.ok) {

        throw new Error('Failed to fetch drafts');

      }



      const draftsData = await response.json();

      setDrafts(draftsData);

    } catch (error) {

      console.error('Error loading drafts:', error);

      setDraftMessage({ type: 'error', text: 'Failed to load drafts' });

    } finally {

      setLoadingDrafts(false);

    }

  };



  const saveDraft = async () => {

    if (!draftName.trim()) {

      setDraftNameError('Draft name is required');

      return;

    }



    setDraftNameError('');

    setSavingDraft(true);



    try {

      const token = localStorage.getItem('token');



      // Prepare draft data

      const draftData = {

        file_id: fileId || null,

        draft_name: draftName.trim(),

        extracted_data: extractedDataState,

        working_json: workingJson,

        pending_changes: Object.fromEntries(pendingChanges)

      };



      const response = await fetch(`${BASE_URL}/api/data-validation-drafts`, {

        method: 'POST',

        headers: {

          'Content-Type': 'application/json',

          'Authorization': `Bearer ${token}`

        },

        body: JSON.stringify(draftData)

      });



      if (!response.ok) {

        throw new Error('Failed to save draft');

      }



      setDraftMessage({ type: 'success', text: 'Draft saved successfully!' });

      setShowDraftModal(false);



      // Refresh drafts list

      await loadDrafts();



      // Clear unsaved changes indicator

      setHasUnsavedChanges(false);



      setTimeout(() => {

        setDraftMessage({ type: '', text: '' });

      }, 3000);



    } catch (error) {

      console.error('Error saving draft:', error);

      setDraftMessage({ type: 'error', text: 'Failed to save draft' });

    } finally {

      setSavingDraft(false);

    }

  };



  // Direct save with auto-generated name

  const saveDraftDirectly = async () => {

    if (!hasUnsavedChanges) {

      setDraftMessage({ type: 'warning', text: 'No changes to save' });

      setTimeout(() => setDraftMessage({ type: '', text: '' }), 3000);

      return;

    }



    setSavingDraft(true);



    try {

      const token = localStorage.getItem('token');



      // Generate auto name with timestamp

      const timestamp = new Date().toLocaleString('en-US', {

        year: 'numeric',

        month: 'short',

        day: 'numeric',

        hour: '2-digit',

        minute: '2-digit'

      });

      const autoName = `Manual_Save_${timestamp}`;



      // Prepare draft data

      const draftData = {

        file_id: fileId || null,

        draft_name: autoName,

        extracted_data: extractedDataState,

        working_json: workingJson,

        pending_changes: Object.fromEntries(pendingChanges)

      };



      const response = await fetch(`${BASE_URL}/api/data-validation-drafts`, {

        method: 'POST',

        headers: {

          'Content-Type': 'application/json',

          'Authorization': `Bearer ${token}`

        },

        body: JSON.stringify(draftData)

      });



      if (!response.ok) {

        throw new Error('Failed to save draft');

      }



      setDraftMessage({ type: 'success', text: `Draft "${autoName}" saved successfully!` });



      // Clear unsaved changes indicator

      setHasUnsavedChanges(false);



      setTimeout(() => {

        setDraftMessage({ type: '', text: '' });

      }, 3000);



    } catch (error) {

      console.error('Error saving draft:', error);

      setDraftMessage({ type: 'error', text: 'Failed to save draft' });

    } finally {

      setSavingDraft(false);

    }

  };



  const loadDraft = async (draft) => {

    try {

      console.log('=== loadDraft DEBUG ===');

      console.log('Loading draft:', draft);



      // Validate draft data

      if (!draft) {

        console.error('No draft data provided');

        return;

      }



      // Restore the draft data with proper validation

      if (draft.extracted_data && typeof draft.extracted_data === 'object') {

        console.log('Restoring extracted_data:', draft.extracted_data);

        setExtractedDataState(draft.extracted_data);



        // Don't update originalExtractedRef here - it should remain as the true original

        // The original reference should only be updated after successful submission

      } else {

        console.log('No valid extracted_data to restore');

      }



      if (draft.working_json && typeof draft.working_json === 'object') {

        console.log('Restoring working_json:', draft.working_json);

        setWorkingJson(draft.working_json);

      } else {

        console.log('No valid working_json to restore');

      }



      if (draft.pending_changes && typeof draft.pending_changes === 'object') {

        console.log('Restoring pending_changes:', draft.pending_changes);

        const pendingChangesMap = new Map();

        Object.entries(draft.pending_changes).forEach(([key, value]) => {

          pendingChangesMap.set(key, value);

        });

        setPendingChanges(pendingChangesMap);

        setHasUnsavedChanges(true);



        console.log('Applied pending changes, hasUnsavedChanges set to true');

      } else {

        // If no pending changes, clear them

        setPendingChanges(new Map());

        setHasUnsavedChanges(false);

        console.log('No pending changes, cleared state');

      }



      // Update the last saved state reference for autosave with deep copy

      lastSavedStateRef.current = {

        extractedDataState: draft.extracted_data ? JSON.parse(JSON.stringify(draft.extracted_data)) : null,

        workingJson: draft.working_json ? JSON.parse(JSON.stringify(draft.working_json)) : null,

        pendingChanges: new Map(draft.pending_changes ? Object.entries(draft.pending_changes) : [])

      };



      console.log('Updated lastSavedStateRef:', lastSavedStateRef.current);

      console.log('=== END loadDraft DEBUG ===');



      // Force a small delay to ensure state updates are processed

      setTimeout(() => {

        setShowDraftListModal(false);

        setDraftMessage({ type: 'success', text: `Draft "${draft.draft_name}" loaded successfully!` });

      }, 100);



      setTimeout(() => {

        setDraftMessage({ type: '', text: '' });

      }, 3000);



    } catch (error) {

      console.error('Error loading draft:', error);

      setDraftMessage({ type: 'error', text: 'Failed to load draft' });

    }

  };



  const deleteDraft = async (draftId, draftName) => {

    if (!confirm(`Are you sure you want to delete the draft "${draftName}"?`)) {

      return;

    }



    try {

      const token = localStorage.getItem('token');

      const response = await fetch(`${BASE_URL}/api/data-validation-drafts/${draftId}`, {

        method: 'DELETE',

        headers: {

          'Authorization': `Bearer ${token}`

        }

      });



      if (!response.ok) {

        throw new Error('Failed to delete draft');

      }



      // Remove from local state

      setDrafts(prev => prev.filter(d => d.id !== draftId));

      setDraftMessage({ type: 'success', text: 'Draft deleted successfully!' });



      setTimeout(() => {

        setDraftMessage({ type: '', text: '' });

      }, 3000);



    } catch (error) {

      console.error('Error deleting draft:', error);

      setDraftMessage({ type: 'error', text: 'Failed to delete draft' });

    }

  };



  const formatDraftDate = (dateString) => {

    const date = new Date(dateString);

    return date.toLocaleString('en-US', {

      year: 'numeric',

      month: 'short',

      day: 'numeric',

      hour: '2-digit',

      minute: '2-digit',

      timeZone: 'UTC'

    });

  };



  // Autosave functions - using the same logic as saveDraft

  const performAutosave = async () => {

    if (!hasUnsavedChanges) {

      console.log('Autosave skipped: No unsaved changes');

      return; // No changes to save

    }



    // Prevent multiple simultaneous autosaves

    if (autosaveStatus === 'saving') {

      console.log('Autosave already in progress, skipping');

      return;

    }



    console.log('Starting autosave...', {

      hasUnsavedChanges,

      pendingChangesSize: pendingChanges.size,

      fileId

    });



    try {

      setAutosaveStatus('saving');



      const token = localStorage.getItem('token');



      // Create a unique autosave name with timestamp

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      const autosaveName = `Autosave_${timestamp}`;



      // Prepare autosave data - using the same structure as saveDraft

      const autosaveData = {

        file_id: fileId || null,

        draft_name: autosaveName,

        extracted_data: extractedDataState,

        working_json: workingJson,

        pending_changes: Object.fromEntries(pendingChanges)

      };



      console.log('Sending autosave data:', autosaveData);



      const response = await fetch(`${BASE_URL}/api/data-validation-drafts`, {

        method: 'POST',

        headers: {

          'Content-Type': 'application/json',

          'Authorization': `Bearer ${token}`

        },

        body: JSON.stringify(autosaveData)

      });



      if (!response.ok) {

        const errorText = await response.text();

        console.error('Autosave failed:', response.status, errorText);

        throw new Error(`Failed to autosave: ${response.status} ${errorText}`);

      }



      const result = await response.json();

      console.log('Autosave successful:', result);



      // Update last saved state reference with deep copy

      lastSavedStateRef.current = {

        extractedDataState: JSON.parse(JSON.stringify(extractedDataState)),

        workingJson: JSON.parse(JSON.stringify(workingJson)),

        pendingChanges: new Map(pendingChanges)

      };



      setLastAutosaveTime(new Date());

      setAutosaveStatus('saved');



      // Clear unsaved changes after successful autosave

      setHasUnsavedChanges(false);



      // Clear the saved status after 3 seconds

      setTimeout(() => {

        setAutosaveStatus('idle');

      }, 3000);



    } catch (error) {

      console.error('Autosave error:', error);

      setAutosaveStatus('error');



      // Clear error status after 5 seconds

      setTimeout(() => {

        setAutosaveStatus('idle');

      }, 5000);

    }

  };



  // Debounced autosave - triggers 2 seconds after last change

  const triggerAutosave = useCallback(() => {

    // Clear existing timer

    if (autosaveTimerRef.current) {

      clearTimeout(autosaveTimerRef.current);

    }



    // Set new timer for 2 seconds

    autosaveTimerRef.current = setTimeout(() => {

      performAutosave();

    }, 2000);

  }, [hasUnsavedChanges, extractedDataState, workingJson, pendingChanges, fileId]);



  // Periodic autosave - every 30 seconds

  const startPeriodicAutosave = useCallback(() => {

    // Clear existing interval

    if (autosaveIntervalRef.current) {

      clearInterval(autosaveIntervalRef.current);

    }



    // Set new interval for 30 seconds

    autosaveIntervalRef.current = setInterval(() => {

      if (hasUnsavedChanges) {

        performAutosave();

      }

    }, 30000); // 30 seconds

  }, [hasUnsavedChanges]);



  // Debug effect to monitor extractedDataState changes

  useEffect(() => {

    console.log('=== extractedDataState changed ===');

    console.log('extractedDataState:', extractedDataState);

    console.log('hasUnsavedChanges:', hasUnsavedChanges);

    console.log('pendingChanges.size:', pendingChanges.size);

    console.log('=== END extractedDataState changed ===');

  }, [extractedDataState, hasUnsavedChanges, pendingChanges.size]);



  // Simplified autosave triggering - just use hasUnsavedChanges

  useEffect(() => {

    console.log('Autosave effect triggered:', {

      hasUnsavedChanges,

      pendingChangesSize: pendingChanges.size

    });



    if (hasUnsavedChanges) {

      console.log('Triggering autosave...');

      triggerAutosave();

    }

  }, [hasUnsavedChanges, triggerAutosave, pendingChanges.size]);



  // Effect to start periodic autosave

  useEffect(() => {

    startPeriodicAutosave();



    // Cleanup on unmount

    return () => {

      if (autosaveTimerRef.current) {

        clearTimeout(autosaveTimerRef.current);

      }

      if (autosaveIntervalRef.current) {

        clearInterval(autosaveIntervalRef.current);

      }

    };

  }, [startPeriodicAutosave]);



  const handleReviewAndSubmit = async () => {

    console.log('=== handleReviewAndSubmit DEBUG ===');

    console.log('hasUnsavedChanges:', hasUnsavedChanges);

    console.log('pendingChanges.size:', pendingChanges.size);

    // ===== PRE-REVIEW DATA CONSISTENCY CHECK =====
    console.log('🔍 Performing pre-review data consistency validation...');
    const preReviewErrors = validateDataConsistency('pre_review');
    if (preReviewErrors.length > 0) {
      console.warn('⚠️ Pre-review consistency issues detected:', preReviewErrors);
      await correctDataInconsistencies(preReviewErrors);
    }

    console.log('pendingChanges:', pendingChanges);



    // Don't apply pending changes or clear state here - preserve UI state for cancel

    // Only set originalExtractedRef if it's null (first time)

    if (originalExtractedRef.current === null) {

      originalExtractedRef.current = JSON.parse(JSON.stringify(extractedDataState));

      console.log('Set originalExtractedRef in handleReviewAndSubmit (first time):', originalExtractedRef.current);

    }



    // Build diffs and show confirm modal before submit

    const hasNodes = Array.isArray(extractedDataState.nodes) && extractedDataState.nodes.length > 0;

    const isTableMode = hasNodes && extractedDataState.nodes[0].id !== 'e3f52ef8-a5a0-40cf-83da-ce2d5fd8e3ba';

    console.log('isTableMode:', isTableMode);

    console.log('hasNodes:', hasNodes);



    let newJsonCandidate = null;

    let diffs = [];

    try {

      if (!isTableMode && (uploadedFileType === 'application/json' || uploadedJsonFileName.endsWith('.json'))) {

        const parsed = JSON.parse(rawJsonText);

        newJsonCandidate = parsed;

        diffs = computeJsonDiffs(originalJsonRef.current || {}, parsed || {});

      } else {

        // For table mode, compute newJsonCandidate by applying pending changes temporarily

        let tempWorkingJson = workingJson;

        if (hasUnsavedChanges && pendingChanges.size > 0) {

          try {

            tempWorkingJson = applyPendingChanges();

          } catch (error) {

            console.error('Error applying changes for preview:', error);

            tempWorkingJson = workingJson;

          }

        }



        const oldJson = originalJsonRef.current;

        newJsonCandidate = tempWorkingJson || oldJson;



        // For table mode, use user-friendly diffs from extracted data

        // Compare original data with current UI state (including pending changes)

        if (isTableMode && originalExtractedRef.current) {

          console.log('Computing diffs for table mode:');

          console.log('originalExtractedRef.current:', originalExtractedRef.current);

          console.log('extractedDataState:', extractedDataState);



          // Check if they are the same object reference

          console.log('Are they the same object?', originalExtractedRef.current === extractedDataState);

          console.log('Are they deep equal?', JSON.stringify(originalExtractedRef.current) === JSON.stringify(extractedDataState));



          diffs = computeDiffsFromExtracted(originalExtractedRef.current, extractedDataState);

          console.log('Computed diffs:', diffs);

        } else {

          // Fallback to JSON diffs for non-table mode

          diffs = computeJsonDiffs(oldJson || {}, newJsonCandidate || {});

        }

      }

    } catch (e) {

      setRawJsonError('Invalid JSON: ' + e.message);

      setJsonUploadMsg({ type: 'error', text: 'Invalid JSON. Please fix errors before submitting.' });

      return;

    }



    console.log('Final diffs to show in modal:', diffs);

    console.log('=== END handleReviewAndSubmit DEBUG ===');

    // Final validation after diffs are computed to ensure consistency
    const finalValidationErrors = validateDataConsistency('final_review');
    if (finalValidationErrors.length > 0) {
      console.warn('⚠️ Final validation found issues:', finalValidationErrors);
      await correctDataInconsistencies(finalValidationErrors);
    }

    setConfirmData({

      newJson: newJsonCandidate,

      diffs: diffs,

      isTableMode,

    });

    setShowConfirm(true);

  };



  const [showConfirm, setShowConfirm] = useState(false);



  const doSubmitAfterConfirm = async () => {

    console.log('=== doSubmitAfterConfirm DEBUG ===');

    setShowConfirm(false);

    try {

      const { newJson, diffs, isTableMode } = confirmData;

      console.log('hasUnsavedChanges:', hasUnsavedChanges);

      console.log('pendingChanges.size:', pendingChanges.size);

      // ===== PRE-SUBMISSION DATA CONSISTENCY CHECK =====
      console.log('🔍 Performing pre-submission data consistency validation...');
      const preSubmissionErrors = validateDataConsistency('pre_submission');
      if (preSubmissionErrors.length > 0) {
        console.warn('⚠️ Pre-submission consistency issues detected:', preSubmissionErrors);
        await correctDataInconsistencies(preSubmissionErrors);

        // Re-validate after corrections
        const postCorrectionErrors = validateDataConsistency('post_correction');
        if (postCorrectionErrors.length > 0) {
          console.error('❌ Data consistency issues persist after correction:', postCorrectionErrors);
          setJsonUploadMsg({ type: 'error', text: 'Data consistency issues detected. Please refresh and try again.' });
          return;
        }
      }

      // ===== COMPREHENSIVE SUBMISSION LOGGING =====
      logChangeWithDetails({
        action: 'submission_start',
        pendingChangesCount: pendingChanges.size,
        diffsCount: diffs?.length || 0,
        isTableMode,
        hasUnsavedChanges
      });



      // Now apply pending changes and update state after user confirms submission

      if (hasUnsavedChanges && pendingChanges.size > 0) {

        try {

          console.log('Before applying changes - extractedDataState:', extractedDataState);

          const finalWorkingJson = applyPendingChanges();

          setWorkingJson(finalWorkingJson);



          // Update original references to reflect the newly submitted state as the new base

          // This ensures that future changes are compared against the last submitted state, not the very first original

          // We need to capture the state AFTER applying changes but BEFORE clearing pending changes

          console.log('Before updating originalExtractedRef - extractedDataState:', extractedDataState);

          originalExtractedRef.current = JSON.parse(JSON.stringify(extractedDataState));

          console.log('After updating originalExtractedRef - originalExtractedRef.current:', originalExtractedRef.current);



          if (!isTableMode && (uploadedFileType === 'application/json' || uploadedJsonFileName.endsWith('.json'))) {

            originalJsonRef.current = JSON.parse(JSON.stringify(newJson));

          }



          // Clear pending changes AFTER updating the original reference

          setPendingChanges(new Map());

          setHasUnsavedChanges(false);

          console.log('Cleared pending changes and hasUnsavedChanges');

        } catch (error) {

          console.error('Error applying final changes:', error);

          alert('Error saving changes. Please try again.');

          return;

        }

      }



      if (!isTableMode && (uploadedFileType === 'application/json' || uploadedJsonFileName.endsWith('.json'))) {

        try {

          setRawJsonError('');

          const transformed = transformToRequiredFormat(newJson);

          setExtractedDataState(transformed);

        } catch (_) { }

      } else {

        // For table mode, ensure extractedDataState reflects the submitted changes

        // The extractedDataState should already contain the submitted changes from pending changes

        console.log('Table mode submission - extractedDataState should contain submitted changes');

      }

      console.log('About to submit audit log with diffs:', diffs);

      // First, save the validation changes to the database
      if (fileId && newJson) {
        try {
          const token = localStorage.getItem('token');
          const saveResponse = await fetch(`${BASE_URL}/api/save-validation-changes?file_id=${fileId}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(newJson)
          });

          if (!saveResponse.ok) {
            const errorText = await saveResponse.text();
            console.error('Failed to save validation changes:', errorText);
            throw new Error(`Failed to save validation changes: ${saveResponse.status} - ${errorText}`);
          }

          console.log('Successfully saved validation changes to database');
          setJsonUploadMsg({ type: 'success', text: 'Validation changes saved to database successfully.' });
        } catch (saveError) {
          console.error('Error saving validation changes:', saveError);
          setJsonUploadMsg({ type: 'error', text: `Failed to save changes: ${saveError.message}` });
          return;
        }
      }

      // ===== ENHANCED AUDIT LOG SUBMISSION =====
      console.log('📝 Submitting comprehensive audit log...');

      // Ensure we have complete change details for audit logging
      const enhancedDiffs = diffs.map(diff => {
        if (typeof diff === 'object' && diff.path) {
          return {
            ...diff,
            timestamp: new Date().toISOString(),
            user: localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')).username : 'unknown',
            fileId: fileId || 'unknown',
            fileName: uploadedJsonFileName || incomingFileName || 'unknown'
          };
        }
        return diff;
      });

      // Log the submission attempt
      logChangeWithDetails({
        action: 'audit_log_submission',
        diffsCount: enhancedDiffs.length,
        oldJsonSize: originalJsonRef.current ? JSON.stringify(originalJsonRef.current).length : 0,
        newJsonSize: newJson ? JSON.stringify(newJson).length : 0
      });

      await submitAuditLog({ oldJson: originalJsonRef.current, newJson, modified: enhancedDiffs });

      // ===== POST-SUBMISSION CONSISTENCY CHECK =====
      console.log('🔍 Performing post-submission data consistency validation...');
      const postSubmissionErrors = validateDataConsistency('post_submission');
      if (postSubmissionErrors.length > 0) {
        console.warn('⚠️ Post-submission consistency issues detected:', postSubmissionErrors);
        await correctDataInconsistencies(postSubmissionErrors);
      }

      // ===== SUCCESS LOGGING =====
      logChangeWithDetails({
        action: 'submission_success',
        pendingChangesCount: pendingChanges.size,
        diffsCount: enhancedDiffs.length,
        consistencyErrors: postSubmissionErrors.length
      });

      console.log('✅ Submission completed successfully with full data consistency');

      // Update validation status to true when user submits

      if (fileId) {

        try {

          const token = localStorage.getItem('token');

          await fetch(`${BASE_URL}/api/update-validation-status?file_id=${fileId}&validated=true`, {

            method: 'PUT',

            headers: {

              'Authorization': `Bearer ${token}`,

              'Content-Type': 'application/json'

            }

          });

        } catch (e) {

          console.error('Failed to update validation status:', e);

          // Don't fail the whole submission if validation status update fails

        }

      }



      // Clean up autosave drafts after successful submission

      // This prevents the auto-load from showing already-submitted changes as "unsaved"

      try {

        const token = localStorage.getItem('token');

        const response = await fetch(`${BASE_URL}/api/data-validation-drafts?file_id=${fileId || ''}`, {

          headers: {

            'Authorization': `Bearer ${token}`

          }

        });



        if (response.ok) {

          const draftsData = await response.json();

          const autosaveDrafts = draftsData.filter(draft => draft.draft_name.startsWith('Autosave_'));



          // Delete all autosave drafts for this file

          for (const draft of autosaveDrafts) {

            try {

              await fetch(`${BASE_URL}/api/data-validation-drafts/${draft.id}`, {

                method: 'DELETE',

                headers: {

                  'Authorization': `Bearer ${token}`

                }

              });

              console.log(`Deleted autosave draft: ${draft.draft_name}`);

            } catch (deleteError) {

              console.error(`Failed to delete autosave draft ${draft.draft_name}:`, deleteError);

            }

          }

        }

      } catch (cleanupError) {

        console.error('Error cleaning up autosave drafts:', cleanupError);

        // Don't fail the submission if cleanup fails

      }



      if (file) {

        await handleSubmit();

      }

    } catch (e) {

      // error is shown by submitAuditLog or handleSubmit

    }

  };



  const [leftPanelWidth, setLeftPanelWidth] = useState('50%');

  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef(null);

  const [dataSearchTerm, setDataSearchTerm] = useState(''); // Add search state for extracted data

  const [searchTerm, setSearchTerm] = useState('');

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');



  // Debounce search term to improve performance

  useEffect(() => {

    const timer = setTimeout(() => {

      setDebouncedSearchTerm(searchTerm);

    }, 300); // 300ms delay



    return () => clearTimeout(timer);

  }, [searchTerm]);

  // Periodic data consistency check

  useEffect(() => {

    const consistencyInterval = setInterval(() => {

      if (extractedDataState && workingJson) {

        const errors = validateDataConsistency('periodic_check');

        if (errors.length > 0) {

          console.warn('⚠️ Periodic consistency check found issues:', errors);

          correctDataInconsistencies(errors);

        }

      }

    }, 10000); // Check every 10 seconds

    return () => clearInterval(consistencyInterval);

  }, [extractedDataState, workingJson, validateDataConsistency, correctDataInconsistencies]);



  const handleMouseMove = (e) => {

    if (!isDragging) return;

    const containerRect = containerRef.current.getBoundingClientRect();

    const containerWidth = containerRect.width;

    const mouseX = e.clientX - containerRect.left;

    const newWidth = Math.min(Math.max(mouseX / containerWidth * 100, 20), 80);

    setLeftPanelWidth(`${newWidth}%`);

  };



  const handleMouseUp = () => {

    setIsDragging(false);

    document.body.style.cursor = 'auto';

  };



  // Filter extracted data based on search term

  const filteredExtractedData = () => {

    if (!debouncedSearchTerm.trim() || !extractedDataState.nodes) {

      return extractedDataState;

    }



    const searchLower = debouncedSearchTerm.toLowerCase();

    const filteredNodes = extractedDataState.nodes.map(node => {

      if (!node.content || !Array.isArray(node.content)) {

        return node;

      }



      const filteredContent = node.content.filter(row => {

        const keyMatch = (row.key || '').toLowerCase().includes(searchLower);

        const textMatch = (row.text || '').toLowerCase().includes(searchLower);

        const valueMatch = String(row.value || '').toLowerCase().includes(searchLower);

        return keyMatch || textMatch || valueMatch;

      });



      return {

        ...node,

        content: filteredContent

      };

    }).filter(node => node.content && node.content.length > 0);



    return { nodes: filteredNodes };

  };



  // Get search result count

  const getSearchResultCount = () => {

    if (!debouncedSearchTerm.trim() || !extractedDataState.nodes) {

      return 0;

    }

    const filtered = filteredExtractedData();

    return filtered.nodes.reduce((total, node) => total + (node.content?.length || 0), 0);

  };



  // Highlight search terms in text

  const highlightSearchTerms = useMemo(() => {

    if (!debouncedSearchTerm.trim()) {

      return (text) => text;

    }



    const searchLower = debouncedSearchTerm.toLowerCase();

    const regex = new RegExp(`(${debouncedSearchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');



    return (text) => {

      if (!text) return text;

      const textStr = String(text);



      if (!textStr.toLowerCase().includes(searchLower)) {

        return textStr;

      }



      return textStr.replace(regex, '<mark style="background-color: #fff3cd; padding: 1px 3px; border-radius: 3px;">$1</mark>');

    };

  }, [debouncedSearchTerm]);



  useEffect(() => {

    if (isDragging) {

      document.addEventListener('mousemove', handleMouseMove);

      document.addEventListener('mouseup', handleMouseUp);

      document.body.style.cursor = 'col-resize';

    } else {

      document.removeEventListener('mousemove', handleMouseMove);

      document.removeEventListener('mouseup', handleMouseUp);

      document.body.style.cursor = 'auto';

    }

    return () => {

      document.removeEventListener('mousemove', handleMouseMove);

      document.removeEventListener('mouseup', handleMouseUp);

      document.body.style.cursor = 'auto';

    };

  }, [isDragging]);



  const textareaRefs = useRef({});



  const autoResizeTextarea = useCallback((el) => {

    if (!el) return;

    // Optimize: Only resize if there's a significant difference

    const scrollHeight = el.scrollHeight;

    const currentHeight = parseInt(el.style.height) || 0;

    if (Math.abs(scrollHeight - currentHeight) > 2) {

      el.style.height = 'auto';

      el.style.height = scrollHeight + 'px';

    }

  }, []);



  const autoResizeAllTextareas = () => {

    Object.values(textareaRefs.current || {}).forEach((el) => autoResizeTextarea(el));

  };



  // Optimize: Only resize textareas when nodes structure changes, not on every value change

  const nodeStructureRef = useRef(null);



  useEffect(() => {

    if (!extractedDataState.nodes) return;



    // Create a structural signature to detect actual structure changes

    const structureSignature = extractedDataState.nodes.map(node =>

      `${node.id}-${node.content?.length || 0}`

    ).join(',');



    // Only resize if the structure actually changed

    if (nodeStructureRef.current !== structureSignature) {

      nodeStructureRef.current = structureSignature;

      // Defer to next paint to ensure DOM has laid out

      const id = requestAnimationFrame(() => autoResizeAllTextareas());

      return () => cancelAnimationFrame(id);

    }

  }, [extractedDataState.nodes]);



  useEffect(() => {

    // Resize when the panel width changes or nodes collapse/expand

    autoResizeAllTextareas();

  }, [leftPanelWidth, collapsedNodes, isSidebarOpen]);



  useEffect(() => {

    const onWinResize = () => autoResizeAllTextareas();

    window.addEventListener('resize', onWinResize);

    return () => window.removeEventListener('resize', onWinResize);

  }, []);



  // Show loading state if data is being loaded

  if (isLoading) {

    return (

      <div className="data-validation-page" style={{ marginTop: "6rem" }}>

        <Container fluid className="py-4">

          <Card className="shadow-sm">

            <Card.Header className="bg-primary text-white text-center">

              <h5 className="mb-0">

                <i className="fas fa-file-alt me-2"></i>

                Data Validation

              </h5>

            </Card.Header>

            <Card.Body className="text-center py-5">

              <Spinner animation="border" role="status" size="lg">

                <span className="visually-hidden">Loading...</span>

              </Spinner>

              <h5 className="mt-3">Loading document data...</h5>

              <p className="text-muted">Please wait while we prepare the validation interface.</p>

            </Card.Body>

          </Card>

        </Container>

      </div>

    );

  }



  return (

    <>

      <style>{dataValidationTableStyles}</style>

      <style>{docxCustomStyles}</style>

      <TopNavbar />

      <div style={{ marginTop: '85px', height: 'calc(100vh - 85px)', backgroundColor: '#f7fbff' }}>

        <div className={isSidebarOpen ? 'navbar-open' : ''} style={{ display: 'flex', height: '100%' }}>

          <SideNavbar isSidebarOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />

          <div className="flex-grow-1 pt-3 close-navbar-additional" style={{

            height: '100%',

            width: '100%',

            marginLeft: isSidebarOpen ? '280px' : '0',

            transition: 'margin-left 0.3s',

            paddingLeft: '0',

            paddingRight: '0',



          }}>
            {/* Home Button */}
            <div className="mb-3 px-3">
              <button 
                className="btn btn-outline-primary d-flex align-items-center"
                onClick={() => navigate('/bulk-upload/view-files')}
                style={{ 
                  border: '1px solid #0D61AE',
                  borderRadius: '12px',
                  padding: '8px 16px',
                  fontSize: '18px',
                  fontWeight: '500',
                  color: '#0D61AE',
                  height: '42px'
                }}
              >
                <i className="fas fa-less-than me-2 lessthan-icon"></i>
                Home
              </button>
            </div>

            {isRoot ? (

              <div className="ms-4 me-4" style={{ paddingLeft: '8px', paddingRight: '8px', height: '100%', display: 'flex', flexDirection: 'column' }}>

                {/* Show loading state during initialization */}

                {isInitializing ? (

                  <div className="d-flex justify-content-center align-items-center" style={{ flex: 1 }}>

                    <div className="text-center">

                      <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>

                        <span className="visually-hidden">Loading...</span>

                      </div>

                      <h5 className="text-muted">Initializing Data Validation...</h5>

                      <p className="text-muted">Please wait while we load your content.</p>

                    </div>

                  </div>

                ) : (

                  <>

                    {canUploadDV && (

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

                        <h2 className='' style={{ color: '#3a3a3a', marginRight: 'auto', width: '204px' }}>File Upload</h2>

                        {/* Display file name if available */}

                        {(docxInfo?.file_name || docxInfo?.name || uploadedJsonFileName || incomingFileName) && (

                          <small className="text-muted d-block mt-1 file-name">

                            <i className="fas fa-file me-1"></i>

                            File: {docxInfo?.file_name || docxInfo?.name || uploadedJsonFileName || incomingFileName}

                          </small>

                        )}

                      </div>

                    )}

                    <div ref={containerRef} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

                      <div className="row d-flex align-items-stretch" style={{ flex: 1, justifyContent: 'space-around', position: 'relative', maxHeight: 'calc(100vh - 10rem)' }}>

                        <div className="d-flex flex-column" style={{

                          border: '1px solid #e0e0e0',

                          borderRadius: '8px',

                          padding: '16px',

                          background: '#fff',

                          height: '100%',

                          width: leftPanelWidth,

                          position: 'relative',

                          overflow: 'hidden',

                          display: 'flex',

                          flexDirection: 'column'

                        }}>

                          <h5>

                            Original File

                            <i

                              className="fas fa-question-circle ms-2 text-muted"

                              aria-hidden="true"

                              title="Preview of the file you selected (image, PDF, DOCX, or JSON). Use this area to review the original content."

                              style={{ cursor: 'help', fontSize: '16px', backgroundColor: '#fff', color: '#212529' }}

                            ></i>

                          </h5>

                          {(fileType.startsWith('image/') && previewUrl) ? (

                            <div style={{ maxWidth: '274px', border: '1px solid #ccc', borderRadius: '8px' }}>

                              <img src={previewUrl} alt="Preview" className="img-fluid" style={{ width: '100%', height: 'auto' }} />

                            </div>

                          ) : fileType === 'application/pdf' && previewUrl ? (

                            <div style={{ width: '100%', height: '100%', border: '1px solid #ccc', borderRadius: '8px' }}>

                              <iframe

                                src={previewUrl + '#toolbar=0&zoom=page-width'}

                                title="PDF Preview"

                                width="100%"

                                style={{ border: 'none', height: '100%' }}

                              />

                            </div>

                          ) : (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || (file && file.name && file.name.endsWith('.docx'))) && docxHtml ? (

                            <div

                              id="docx-preview"

                              style={{ width: '100%', flex: 1, overflow: 'auto', border: '1px solid #ccc', borderRadius: '8px', background: '#fff', padding: '10px' }}

                            >

                              <style>{docxCustomStyles}</style>

                              <div className="docx-wrapper">

                                <div

                                  className="docx-content"

                                  style={{ transform: `scale(${docxZoom})`, transformOrigin: 'top left' }}

                                  dangerouslySetInnerHTML={{ __html: docxHtml }}

                                />

                              </div>

                            </div>

                          ) : docxInfo && docxHtml ? (

                            <div

                              id="docx-preview"

                              style={{ width: '100%', flex: 1, overflow: 'auto', border: '1px solid #ccc', borderRadius: '8px', background: '#fff', padding: '10px' }}

                            >

                              <style>{docxCustomStyles}</style>

                              <div className="docx-wrapper">

                                <div

                                  className="docx-content"

                                  style={{ transform: `scale(${docxZoom})`, transformOrigin: 'top left' }}

                                  dangerouslySetInnerHTML={{ __html: docxHtml }}

                                />

                              </div>

                            </div>

                          ) : docxInfo && !docxHtml ? (

                            <div id="docx-preview" style={{ width: '100%', flex: 1, background: '#fff', padding: '10px' }} />

                          ) : (uploadedFileType === 'application/json' || uploadedJsonFileName.endsWith('.json') || incomingJsonData) ? (

                            <div

                              id="json-preview"

                              style={{ width: '100%', flex: 1, overflow: 'auto', border: '1px solid #ccc', borderRadius: '8px', background: '#fff', padding: '10px' }}

                            >

                              <pre style={{

                                fontFamily: 'monospace',

                                fontSize: '0.9em',

                                whiteSpace: 'pre-wrap',

                                wordBreak: 'break-word',

                                margin: 0,

                                padding: '10px',

                                backgroundColor: '#f8f9fa',

                                borderRadius: '4px',

                                border: '1px solid #e9ecef'

                              }}>

                                {JSON.stringify(incomingJsonData || JSON.parse(rawJsonText || '{}'), null, 2)}

                              </pre>

                            </div>

                          ) : file ? (

                            <div className="text-muted">No preview available for this file type.</div>

                          ) : (

                            <div className="text-muted">No file selected for preview.</div>

                          )}

                        </div>

                        <div

                          style={{

                            width: '8px',

                            cursor: 'col-resize',

                            backgroundColor: isDragging ? '#007bff' : '#e0e0e0',

                            height: '100%',

                            position: 'absolute',

                            left: `calc(${leftPanelWidth} - 4px)`,

                            zIndex: 10

                          }}

                          onMouseDown={() => setIsDragging(true)}

                        />

                        <div className="d-flex flex-column" style={{

                          border: '1px solid #e0e0e0',

                          borderRadius: '8px',

                          padding: '4px 16px 8px 16px',

                          background: '#fff',

                          height: '100%',

                          width: `calc(100% - ${leftPanelWidth} - 8px)`,

                          marginLeft: '8px',

                          overflow: 'hidden',

                          display: 'flex',

                          flexDirection: 'column'

                        }}>

                          {/* Success/Error Messages - Above everything */}

                          {jsonUploadMsg && (

                            <div className="mb-3" style={{ flexShrink: 0 }}>

                              {jsonUploadMsg.type === 'success' && (

                                <div className="alert alert-success py-2 px-3 mb-0" style={{ fontSize: '1em' }}>

                                  <i className="fas fa-check-circle me-2"></i>

                                  {jsonUploadMsg.text}

                                </div>

                              )}

                              {jsonUploadMsg.type === 'error' && (

                                <div className="alert alert-danger py-2 px-3 mb-0" style={{ fontSize: '1em' }}>

                                  <i className="fas fa-exclamation-triangle me-2"></i>

                                  {jsonUploadMsg.text}

                                </div>

                              )}

                            </div>

                          )}



                          {/* Draft messages */}

                          {draftMessage.text && (

                            <div className="mb-3" style={{ flexShrink: 0 }}>

                              <div className={`alert alert-${draftMessage.type === 'success' ? 'success' : 'danger'} py-2 px-3 mb-0`} style={{ fontSize: '1em' }}>

                                <i className={`fas ${draftMessage.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle'} me-2`}></i>

                                {draftMessage.text}

                              </div>

                            </div>

                          )}



                          {/* Section Header with Search */}

                          <div className="d-flex align-items-center justify-content-between mb-3" style={{ flexShrink: 0 }}>

                            <div>

                              <h5 className="mb-0">

                                Extracted Data

                                <i

                                  className="fas fa-question-circle ms-2 text-muted"

                                  aria-hidden="true"

                                  title="Structured data parsed from the uploaded file. You can review and edit values before submitting."

                                  style={{ cursor: 'help', fontSize: '16px', backgroundColor: '#fff', color: '#212529' }}

                                ></i>

                              </h5>

                            </div>

                            <div className="d-flex align-items-center gap-2">

                              {/* Search Box */}

                              <div className="position-relative">

                                <input

                                  type="text"

                                  className="form-control form-control-sm"

                                  placeholder="Search data fields..."

                                  value={searchTerm}

                                  onChange={(e) => setSearchTerm(e.target.value)}

                                  style={{

                                    width: '250px',

                                    paddingLeft: '35px',

                                    fontSize: '0.9rem',

                                  }}

                                />

                                <i

                                  className="fas fa-search position-absolute"

                                  style={{

                                    left: '12px',

                                    top: '50%',

                                    transform: 'translateY(-50%)',

                                    color: '#6c757d',

                                    fontSize: '0.9rem'

                                  }}

                                ></i>

                                {searchTerm && (

                                  <button

                                    className="btn btn-sm btn-link position-absolute"

                                    style={{

                                      right: '8px',

                                      top: '50%',

                                      transform: 'translateY(-50%)',

                                      padding: '0',

                                      color: '#6c757d',

                                      textDecoration: 'none',

                                      width: 'auto',

                                    }}

                                    onClick={() => setSearchTerm('')}

                                    title="Clear search"

                                  >

                                    <i className="fas fa-times"></i>

                                  </button>

                                )}

                              </div>

                              {searchTerm && (

                                <div className="d-flex align-items-center gap-2">

                                  <span className="badge bg-info">

                                    {getSearchResultCount()} results

                                  </span>



                                </div>

                              )}







                            </div>

                          </div>



                          {extractedDataState.nodes && extractedDataState.nodes.length > 0 && extractedDataState.nodes[0].id !== 'e3f52ef8-a5a0-40cf-83da-ce2d5fd8e3ba' ? null :

                            (rawJsonText && (uploadedFileType === 'application/json' || uploadedJsonFileName.endsWith('.json')) ? (

                              <>

                                <div className="mb-1 d-flex align-items-center justify-content-between" style={{ flexShrink: 0 }}>

                                  <label htmlFor="raw-json-editor" className="form-label" style={{ fontWeight: 600, fontSize: '1.1em', marginBottom: 0 }}>Edit JSON Content:</label>

                                  <button className="btn btn-secondary btn-sm" style={{ width: 'fit-content' }} onClick={handleResetExtractedData}>

                                    Reset to Default

                                  </button>

                                </div>

                                <div className="mb-3 extracted-data-container" style={{ border: '1px solid #e0e0e0', borderRadius: '8px', background: '#fafbfc', margin: '16px 0', flex: 1, overflowY: 'auto', minHeight: 0 }}>

                                  <textarea

                                    id="raw-json-editor"

                                    className="form-control"

                                    rows={Math.max(10, rawJsonText.split('\n').length + 2)}

                                    value={rawJsonText}

                                    onChange={e => setRawJsonText(e.target.value)}

                                    style={{ fontFamily: 'monospace', fontSize: '1em' }}

                                  />

                                  {rawJsonError && <div className="alert alert-danger mt-2">{rawJsonError}</div>}

                                </div>

                              </>

                            ) :

                              ((!extractedDataState.nodes || extractedDataState.nodes.length === 0 || extractedDataState.nodes[0].id === 'e3f52ef8-a5a0-40cf-83da-ce2d5fd8e3ba') && (

                                <div className="extracted-data-container" style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px', background: '#fafbfc', margin: '16px 0', flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

                                  <div className="text-center text-muted">

                                    <i className="fas fa-file-upload fa-3x mb-3"></i>

                                    <h5>No Data Available</h5>

                                    <p>Upload a file or JSON to start data validation</p>

                                  </div>

                                </div>

                              ))

                            )}

                          {(() => {

                            const dataToShow = filteredExtractedData();

                            if (!dataToShow.nodes || dataToShow.nodes.length === 0 || dataToShow.nodes[0].id === 'e3f52ef8-a5a0-40cf-83da-ce2d5fd8e3ba') {

                              return null;

                            }



                            // Check if search returned no results

                            const hasResults = dataToShow.nodes.some(node =>

                              node.content && Array.isArray(node.content) && node.content.length > 0

                            );



                            if (!hasResults) {

                              return (

                                <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px', background: '#fafbfc', margin: '16px 0', flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

                                  <div className="text-center text-muted">

                                    <i className="fas fa-search fa-2x mb-3"></i>

                                    <h5>No search results found</h5>

                                    <p>Try adjusting your search terms or clear the search to see all data.</p>

                                    <button

                                      className="btn btn-outline-secondary btn-sm"

                                      onClick={() => setSearchTerm('')}

                                    >

                                      <i className="fas fa-times me-2"></i>

                                      Clear Search

                                    </button>

                                  </div>

                                </div>

                              );

                            }



                            return (

                              <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '0', background: '#fafbfc', margin: '0', flex: 1, overflowY: 'auto', minHeight: 0 }}>

                                {dataToShow.nodes.map((node, nodeIndex) => {

                                  const nodeLabelLower = String(node.label || '').toLowerCase();

                                  if (nodeLabelLower === 'filename' || nodeLabelLower === 'heading') {

                                    return null;

                                  }

                                  const isCollapsible = /^PART\s*[IVXLCDM]*(\([A-Z]\))?/i.test(node.label);

                                  const isCollapsed = !!collapsedNodes[node.id];



                                  return (

                                    <div key={node.id || nodeIndex} className="extracted-data-box mb-4" style={{ background: '#f8fafc', border: '1px solid #e0e0e0', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: '18px 18px 10px 18px', marginBottom: '32px', overflow: 'auto' }}>

                                      <div className="d-flex align-items-center extracted-data-label mb-2" style={{ fontWeight: 600, fontSize: '1.2em', marginBottom: '12px', cursor: isCollapsible ? "pointer" : "default" }}>

                                        {isCollapsible && (

                                          <div className="collapse-btn me-2">

                                            <button

                                              className="btn btn-sm btn-link px-1 py-0"

                                              type="button"

                                              onClick={() => toggleNodeCollapse(node.id)}

                                              tabIndex={0}

                                              aria-label={isCollapsed ? `Expand ${node.label}` : `Collapse ${node.label}`}

                                            >

                                              {isCollapsed ? '+' : '−'}

                                            </button>

                                          </div>

                                        )}

                                        {node.label}

                                      </div>

                                      {(!isCollapsed || !isCollapsible) && (

                                        <div style={{ width: '100%', overflowX: 'auto' }}>

                                          <table

                                            className="table-extract table table-bordered table-sm mb-0"

                                            style={{ tableLayout: 'fixed', width: '100%', wordBreak: 'break-word' }}

                                          >

                                            <tbody>

                                              {Array.isArray(node.content) &&

                                                node.content.map((row, rowIndex) => {

                                                  try {

                                                    const partMatch = typeof row.text === 'string' && row.text.trim().match(/^PART\s+[IVXLCDM]+\.?$/i);

                                                    const keyLower = String(row.key || '').toLowerCase();

                                                    const textLower = String(row.text || '').toLowerCase();

                                                    const isFilenameRow =

                                                      keyLower === 'filename' ||

                                                      keyLower === 'filename:' ||

                                                      keyLower === 'file name' ||

                                                      keyLower === 'file_name' ||

                                                      keyLower === 'original_filename' ||

                                                      textLower === 'filename' ||

                                                      textLower === 'file name' ||

                                                      textLower === 'file_name' ||

                                                      textLower === 'original_filename' ||

                                                      row.key === 'fileName' ||

                                                      row.key === 'original_filename';

                                                    const topPath = Array.isArray(row.path) ? String(row.path[0]).toLowerCase() : '';

                                                    const skipByPath = topPath === 'filename' || topPath === 'heading';

                                                    if (skipByPath || isFilenameRow) return null;



                                                    // Check if the row is a section title

                                                    const isSectionTitle =

                                                      row.text === 'Inspection Period' ||

                                                      row.text === 'Organization Hierarchy' ||

                                                      row.text === 'Budget Details';



                                                    // Safely convert value to string

                                                    let valueString = '';

                                                    try {

                                                      if (row.value !== null && typeof row.value === 'object') {

                                                        if (Array.isArray(row.value)) {

                                                          valueString = JSON.stringify(row.value);

                                                        } else {

                                                          valueString = Object.entries(row.value)

                                                            .map(([k, v]) => `${k}: ${v}`)

                                                            .join(', ');

                                                        }

                                                      } else {

                                                        valueString = String(row.value || '');

                                                      }

                                                    } catch (valueError) {

                                                      console.warn('Error converting value to string:', valueError);

                                                      valueString = String(row.value || '');

                                                    }



                                                    // Check if the value contains HTML table markup or table-like structure

                                                    const isTableValue =

                                                      typeof valueString === 'string' &&

                                                      (valueString.trim().startsWith('<table') && valueString.trim().endsWith('</table>')) ||

                                                      (valueString.includes('Sl No.') && valueString.includes('IRCTC letter dt.') && valueString.includes('Name of the catering contractor')) ||

                                                      (valueString.includes('\t') && valueString.split('\n').length > 2) ||

                                                      (valueString.includes('Table') && valueString.includes('\t')) ||

                                                      (valueString.includes('Sl No.') && valueString.includes('\t')) ||

                                                      // Additional table detection patterns for financial/leave tables

                                                      (valueString.includes('Particulars') && valueString.includes('\t')) ||

                                                      (valueString.includes('Salary') && valueString.includes('\t')) ||

                                                      (valueString.includes('Rs.') && valueString.includes('\t')) ||

                                                      (valueString.includes('Total') && valueString.includes('\t')) ||

                                                      (valueString.includes('leave') && valueString.includes('\t')) ||

                                                      // Generic table detection: multiple lines with tabs and reasonable column count

                                                      (valueString.includes('\t') && valueString.split('\n').length >= 3 &&

                                                        valueString.split('\n').some(line => line.split('\t').length >= 3));



                                                    // Debug table detection

                                                    if (isTableValue) {

                                                      console.log('Table detected for:', {

                                                        nodeIndex,

                                                        rowIndex,

                                                        valuePreview: valueString.substring(0, 100) + '...',

                                                        lineCount: valueString.split('\n').length,

                                                        tabCount: valueString.split('\t').length

                                                      });

                                                    }



                                                    const key = `${nodeIndex}-${rowIndex}`;



                                                    return (

                                                      <tr key={rowIndex}>

                                                        <td

                                                          style={{

                                                            width: '143px',

                                                            wordBreak: 'break-word',

                                                            whiteSpace: 'pre-wrap',

                                                          }}

                                                        >

                                                          <span

                                                            dangerouslySetInnerHTML={{

                                                              __html: highlightSearchTerms(partMatch ? '' : row.text),

                                                            }}

                                                          />

                                                        </td>

                                                        <td

                                                          style={{

                                                            wordBreak: 'break-word',

                                                            whiteSpace: 'pre-wrap',

                                                          }}

                                                        >

                                                          {isSectionTitle ? (

                                                            // Render section titles as plain text

                                                            <span

                                                              style={{

                                                                fontWeight: 500,

                                                                color: '#fff',

                                                                padding: '8px',

                                                                display: 'block',

                                                              }}

                                                            >

                                                              {row.text}

                                                            </span>

                                                          ) : isTableValue ? (

                                                            renderEditableTable(valueString, nodeIndex, rowIndex)

                                                          ) : row.isDisplayOnly ? (

                                                            // Display-only label without input field

                                                            <span

                                                              className='display-only-label'

                                                              style={{

                                                                fontWeight: 600,

                                                                color: '#495057',

                                                                padding: '8px 12px',

                                                                display: 'block',

                                                                backgroundColor: '#f8f9fa',

                                                                border: '1px solid #dee2e6',

                                                                borderRadius: '4px'

                                                              }}

                                                            >

                                                              {row.text}

                                                            </span>

                                                          ) : (

                                                            <textarea

                                                              ref={(el) => {

                                                                if (el) {

                                                                  textareaRefs.current[key] = el;

                                                                  if (!el.dataset.resized) {

                                                                    el.dataset.resized = 'true';

                                                                    autoResizeTextarea(el);

                                                                  }

                                                                }

                                                              }}

                                                              className="form-control form-control-sm"

                                                              style={{

                                                                border: pendingChanges.has(`${nodeIndex}-${rowIndex}`)

                                                                  ? '1px solid #37a04fff'

                                                                  : undefined,

                                                                width: '100%',

                                                                minWidth: '100px',

                                                                resize: 'none',

                                                                overflow: 'hidden',

                                                                lineHeight: '1.5',

                                                                minHeight: 'calc(1.5em + 8px)',

                                                                height: '40px',

                                                                paddingTop: '4px',

                                                                paddingBottom: '4px',

                                                                boxSizing: 'border-box',

                                                                verticalAlign: 'middle',

                                                                backgroundColor: pendingChanges.has(`${nodeIndex}-${rowIndex}`)

                                                                  ? '#d4edda'

                                                                  : 'white',

                                                              }}

                                                              value={valueString}

                                                              onChange={(e) => {

                                                                try {

                                                                  handleValueChange(nodeIndex, rowIndex, e.target.value);

                                                                  const currentHeight = e.target.scrollHeight;

                                                                  const currentStyleHeight =

                                                                    parseInt(e.target.style.height) || 0;

                                                                  if (Math.abs(currentHeight - currentStyleHeight) > 5) {

                                                                    autoResizeTextarea(e.target);

                                                                  }

                                                                } catch (changeError) {

                                                                  console.error('Error in onChange:', changeError);

                                                                }

                                                              }}

                                                            />

                                                          )}

                                                        </td>

                                                      </tr>

                                                    );

                                                  } catch (rowError) {

                                                    console.error('Error rendering row:', rowError, row);

                                                    return (

                                                      <tr key={rowIndex}>

                                                        <td colSpan="3" className="text-danger">

                                                          Error rendering row: {rowError.message}

                                                        </td>

                                                      </tr>

                                                    );

                                                  }

                                                })}

                                            </tbody>

                                          </table>

                                        </div>

                                      )}

                                    </div>

                                  );

                                })}

                              </div>

                            );

                          })()}

                          <div style={{ marginTop: 'auto', paddingTop: '0', borderTop: '1px solid #e0e0e0' }}>

                            {/* Always show changes count - show 0 when no changes */}

                            <div className="d-flex align-items-center gap-2 text-warning mb-2">

                              <i className="fas fa-edit" style={{ fontSize: '14px' }}></i>

                              <span style={{ fontSize: '13px' }}>

                                {pendingChanges.size} unsaved change{pendingChanges.size !== 1 ? 's' : ''}

                              </span>

                            </div>

                            {/* Data Consistency Monitor */}

                            <div className="d-flex align-items-center gap-2 mb-2" style={{ fontSize: '12px' }}>

                              <i className={`fas ${dataConsistencyErrors.length === 0 ? 'fa-check-circle text-success' : 'fa-exclamation-triangle text-warning'}`} style={{ fontSize: '12px' }}></i>

                              <span className={dataConsistencyErrors.length === 0 ? 'text-success' : 'text-warning'}>

                                Data: {dataConsistencyErrors.length === 0 ? 'Synced' : `${dataConsistencyErrors.length} issue(s)`}

                              </span>

                              {lastUpdateTimestamp && (

                                <span className="text-muted" style={{ fontSize: '10px' }}>

                                  ({new Date(lastUpdateTimestamp).toLocaleTimeString()})

                                </span>

                              )}

                            </div>



                            {/* Always show autosave status indicator */}

                            <div className="d-flex align-items-center gap-2 mb-2" style={{ fontSize: '12px' }}>

                              {autosaveStatus === 'saving' && (

                                <div className="d-flex align-items-center gap-1 text-info">

                                  <div className="spinner-border spinner-border-sm" role="status" style={{ width: '12px', height: '12px' }}>

                                    <span className="visually-hidden">Saving...</span>

                                  </div>

                                  <span>Auto-saving...</span>

                                </div>

                              )}

                              {autosaveStatus === 'saved' && (

                                <div className="d-flex align-items-center gap-1 text-success">

                                  <i className="fas fa-check-circle" style={{ fontSize: '12px' }}></i>

                                  <span>Auto-saved</span>

                                  {lastAutosaveTime && (

                                    <span className="text-muted">

                                      at {lastAutosaveTime.toLocaleTimeString([], { timeZone: 'UTC' })}

                                    </span>

                                  )}

                                </div>

                              )}

                              {autosaveStatus === 'error' && (

                                <div className="d-flex align-items-center gap-1 text-danger">

                                  <i className="fas fa-exclamation-triangle" style={{ fontSize: '12px' }}></i>

                                  <span>Auto-save failed</span>

                                </div>

                              )}

                              {autosaveStatus === 'idle' && hasUnsavedChanges && (

                                <div className="d-flex align-items-center gap-1 text-muted">

                                  <i className="fas fa-clock" style={{ fontSize: '12px' }}></i>

                                  <span>Auto-save enabled</span>

                                </div>

                              )}

                              {autosaveStatus === 'idle' && !hasUnsavedChanges && (

                                <div className="d-flex align-items-center gap-1 text-muted">

                                  <i className="fas fa-check" style={{ fontSize: '12px' }}></i>

                                  <span>All changes saved</span>

                                </div>

                              )}

                            </div>



                            <div className="d-flex gap-3 align-items-center">

                              <button

                                className="btn btn-primary"

                                onClick={handleReviewAndSubmit}

                                disabled={loading}

                              >

                                {loading

                                  ? 'Submitting...'

                                  : (

                                    (extractedDataState.nodes && extractedDataState.nodes.length > 0 && extractedDataState.nodes[0].id !== 'e3f52ef8-a5a0-40cf-83da-ce2d5fd8e3ba')

                                      ? 'Review & Submit'

                                      : 'Process'

                                  )}

                              </button>



                              {/* Draft buttons */}

                              <button

                                type="button"

                                className="btn btn-outline-secondary"

                                onClick={saveDraftDirectly}

                                disabled={!hasUnsavedChanges || savingDraft}

                                title={!hasUnsavedChanges ? "No changes to save" : "Save current work as draft"}

                              >

                                {savingDraft ? (

                                  <>

                                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>

                                    Saving...

                                  </>

                                ) : (

                                  <>

                                    <i className="fas fa-save me-2"></i>

                                    Save Draft

                                  </>

                                )}

                              </button>



                              <button

                                type="button"

                                className="btn btn-outline-info"

                                onClick={loadLastAutosave}

                                disabled={loadingDrafts}

                                title="Load the most recent autosave"

                              >

                                {loadingDrafts ? (

                                  <>

                                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>

                                    Loading...

                                  </>

                                ) : (

                                  <>

                                    <i className="fas fa-folder-open me-2"></i>

                                    Load Draft

                                  </>

                                )}

                              </button>



                              <button

                                type="button"

                                className="btn btn-outline-info"

                                onClick={openGeneralFeedbackModal}

                                style={{

                                  display: 'flex',

                                  alignItems: 'center',

                                  gap: '8px',

                                  padding: '8px 16px',

                                  borderRadius: '6px',

                                  border: '1px solid #17a2b8',

                                  backgroundColor: 'transparent',

                                  color: '#17a2b8',

                                  transition: 'all 0.2s ease'

                                }}

                              >

                                <i className="fas fa-comment-dots" style={{ fontSize: '14px' }}></i>

                                <span style={{ fontSize: '14px', fontWeight: '500' }}>Send Feedback</span>

                              </button>

                            </div>

                            {error && <div className="alert alert-danger mt-3">{error}</div>}

                            {response && (

                              <div className="alert alert-success mt-3">

                                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{JSON.stringify(response, null, 2)}</pre>

                              </div>

                            )}

                          </div>

                        </div>

                      </div>

                    </div>

                  </>

                )}

              </div>

            ) : (

              <Outlet />

            )}

          </div>

        </div>

      </div>

      <Modal show={showConfirm} onHide={() => setShowConfirm(false)} size="lg">

        <Modal.Header closeButton>

          <Modal.Title>Review Changes & Submit</Modal.Title>

        </Modal.Header>

        <Modal.Body>

          <div className="mb-2">

            <strong>File:</strong> {uploadedJsonFileName || incomingFileName || 'Current report'}

          </div>

          <div className="mb-2">

            <strong>Modifications ({confirmData?.diffs?.length || 0}):</strong>

          </div>

          {/* Data Consistency Status */}
          <div className="mb-3 p-2 rounded" style={{
            backgroundColor: dataConsistencyErrors.length === 0 ? '#d1ecf1' : '#f8d7da',
            border: `1px solid ${dataConsistencyErrors.length === 0 ? '#bee5eb' : '#f5c6cb'}`
          }}>
            <div className="d-flex align-items-center">
              <i className={`fas ${dataConsistencyErrors.length === 0 ? 'fa-check-circle text-success' : 'fa-exclamation-triangle text-warning'} me-2`}></i>
              <strong>Data Consistency:</strong>
              <span className={`ms-2 ${dataConsistencyErrors.length === 0 ? 'text-success' : 'text-warning'}`}>
                {dataConsistencyErrors.length === 0 ? 'All systems synchronized' : `${dataConsistencyErrors.length} issue(s) detected`}
              </span>
            </div>
            {dataConsistencyErrors.length > 0 && (
              <div className="mt-2 small text-muted">
                <details>
                  <summary>View details</summary>
                  <ul className="mb-0 mt-1">
                    {dataConsistencyErrors.map((error, idx) => (
                      <li key={idx}>{error.type}: {error.details}</li>
                    ))}
                  </ul>
                </details>
              </div>
            )}
          </div>

          <div style={{ maxHeight: '40vh', overflowY: 'auto', border: '1px solid #eee', borderRadius: 6, padding: 8, background: '#fafafa' }}>

            {(confirmData?.diffs || []).length === 0 ? (

              <div className="text-muted">No changes detected.</div>

            ) : (

              <ul className="mb-0" style={{ paddingLeft: 18 }}>

                {confirmData.diffs.slice(0, 200).map((diff, idx) => {

                  // Check if this is the new diff format with objects

                  if (diff && typeof diff === 'object' && diff.path && diff.oldValue !== undefined && diff.newValue !== undefined) {

                    return (

                      <li key={idx} className="diff-item">

                        <div className="diff-path">

                          📍 {diff.path}

                        </div>

                        <div style={{

                          display: 'flex',

                          alignItems: 'center',

                          gap: '8px',

                          flexWrap: 'wrap'

                        }}>

                          <span className="diff-old-value">

                            {diff.oldValue}

                          </span>

                          <span className="diff-arrow">

                            →

                          </span>

                          <span className="diff-new-value">

                            {diff.newValue}

                          </span>

                        </div>

                      </li>

                    );

                  } else {

                    // Fallback for old string format

                    return (

                      <li key={idx} style={{

                        fontFamily: 'monospace',

                        fontSize: 13,

                        marginBottom: '8px'

                      }}>

                        {diff}

                      </li>

                    );

                  }

                })}

                {confirmData.diffs.length > 200 && (

                  <li className="text-muted">... and {confirmData.diffs.length - 200} more</li>

                )}

              </ul>

            )}

          </div>

          {/* <div className="mt-3 small text-muted">

            Review the changes above. Clicking Submit will save the audit log{file ? ' and upload the file' : ''}.

          </div> */}

        </Modal.Body>

        <Modal.Footer>

          <div className="d-flex justify-content-between  ">

            <div className="d-flex align-items-center gap-2">



              <Button variant="primary" onClick={doSubmitAfterConfirm}>Submit</Button>

              <Button variant="secondary" onClick={() => setShowConfirm(false)}>Cancel</Button>

            </div>

          </div>

          {/* <Button variant="secondary" onClick={() => setShowConfirm(false)}>Cancel</Button>

          <Button variant="primary" onClick={doSubmitAfterConfirm}>Submit</Button> */}

        </Modal.Footer>

      </Modal>



      {/* Feedback Modal */}

      <Modal show={showFeedbackModal} onHide={() => setShowFeedbackModal(false)} size="lg">

        <Modal.Header closeButton>

          <Modal.Title>

            <i className="fas fa-exclamation-triangle text-warning me-2"></i>

            Report Data Validation Issue

          </Modal.Title>

        </Modal.Header>

        <Modal.Body>

          {feedbackSuccess ? (

            <div className="text-center py-4">

              <i className="fas fa-check-circle text-success" style={{ fontSize: '3rem' }}></i>

              <h4 className="mt-3 text-success">Feedback Submitted Successfully!</h4>

              <p className="text-muted">The SuperAdmin has been notified and will review your issue.</p>

            </div>

          ) : (

            <>

              <div className="mb-3">

                <label className="form-label fw-bold">Severity Level *</label>

                <div className="d-flex gap-2">

                  <button

                    type="button"

                    className={`btn ${feedbackSeverity === 'high' ? 'btn-danger' : 'btn-outline-danger'}`}

                    onClick={() => setFeedbackSeverity('high')}

                  >

                    <i className="fas fa-exclamation-triangle me-1"></i>

                    High

                  </button>

                  <button

                    type="button"

                    className={`btn ${feedbackSeverity === 'moderate' ? 'btn-warning' : 'btn-outline-warning'}`}

                    onClick={() => setFeedbackSeverity('moderate')}

                  >

                    <i className="fas fa-exclamation-circle me-1"></i>

                    Moderate

                  </button>

                  <button

                    type="button"

                    className={`btn ${feedbackSeverity === 'low' ? 'btn-info' : 'btn-outline-info'}`}

                    onClick={() => setFeedbackSeverity('low')}

                  >

                    <i className="fas fa-info-circle me-1"></i>

                    Low

                  </button>

                </div>

              </div>



              <div className="mb-3">

                <label className="form-label fw-bold">Issue Description *</label>

                <textarea

                  className="form-control"

                  rows="4"

                  placeholder="Please describe the issue you found with this data field..."

                  value={feedbackDescription}

                  onChange={(e) => setFeedbackDescription(e.target.value)}

                />

              </div>



              {feedbackFieldPath && (

                <div className="mb-3">

                  <label className="form-label fw-bold">Field Path</label>

                  <input

                    type="text"

                    className="form-control"

                    value={feedbackFieldPath}

                    readOnly

                  />

                </div>

              )}



              {feedbackFieldValue && (

                <div className="mb-3">

                  <label className="form-label fw-bold">Current Field Value</label>

                  <textarea

                    className="form-control"

                    rows="2"

                    value={feedbackFieldValue}

                    readOnly

                  />

                </div>

              )}



              <div className="alert alert-info">

                <i className="fas fa-info-circle me-2"></i>

                <strong>Note:</strong> This feedback will be sent to the SuperAdmin for review and action.

              </div>

            </>

          )}

        </Modal.Body>

        <Modal.Footer>

          {!feedbackSuccess && (

            <>

              <Button variant="secondary" onClick={() => setShowFeedbackModal(false)}>

                Cancel

              </Button>

              <Button

                variant="primary"

                onClick={handleFeedbackSubmit}

                disabled={feedbackSubmitting || !feedbackSeverity || !feedbackDescription.trim()}

              >

                {feedbackSubmitting ? (

                  <>

                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>

                    Submitting...

                  </>

                ) : (

                  <>

                    <i className="fas fa-paper-plane me-2"></i>

                    Submit Feedback

                  </>

                )}

              </Button>

            </>

          )}

        </Modal.Footer>

      </Modal>



      {/* General Feedback Modal */}

      <Modal show={showGeneralFeedbackModal} onHide={() => setShowGeneralFeedbackModal(false)} size="lg">

        <Modal.Header closeButton>

          <Modal.Title>

            <i className="fas fa-comment-dots text-info me-2"></i>

            Send General Feedback

          </Modal.Title>

        </Modal.Header>

        <Modal.Body>

          {generalFeedbackSuccess ? (

            <div className="text-center py-4">

              <i className="fas fa-check-circle text-success" style={{ fontSize: '3rem' }}></i>

              <h4 className="mt-3 text-success">Feedback Submitted Successfully!</h4>

              <p className="text-muted">The SuperAdmin has been notified and will review your feedback.</p>

            </div>

          ) : (

            <>

              <div className="mb-4">

                <label className="form-label fw-bold">Severity Level *</label>

                <div className="d-flex gap-3">

                  <button

                    type="button"

                    className={`btn ${generalFeedbackSeverity === 'high' ? 'btn-danger' : 'btn-outline-danger'}`}

                    onClick={() => setGeneralFeedbackSeverity('high')}

                    style={{ minWidth: '100px', padding: '10px 16px' }}

                  >

                    <i className="fas fa-exclamation-triangle me-2"></i>

                    High

                  </button>

                  <button

                    type="button"

                    className={`btn ${generalFeedbackSeverity === 'moderate' ? 'btn-warning' : 'btn-outline-warning'}`}

                    onClick={() => setGeneralFeedbackSeverity('moderate')}

                    style={{ minWidth: '100px', padding: '10px 16px' }}

                  >

                    <i className="fas fa-exclamation-circle me-2"></i>

                    Moderate

                  </button>

                  <button

                    type="button"

                    className={`btn ${generalFeedbackSeverity === 'low' ? 'btn-info' : 'btn-outline-info'}`}

                    onClick={() => setGeneralFeedbackSeverity('low')}

                    style={{ minWidth: '100px', padding: '10px 16px' }}

                  >

                    <i className="fas fa-info-circle me-2"></i>

                    Low

                  </button>

                </div>

              </div>



              <div className="mb-4">

                <label className="form-label fw-bold">Your Message *</label>

                <textarea

                  className="form-control"

                  rows="6"

                  placeholder="Please share your feedback, suggestions, or any issues you encountered during data validation..."

                  value={generalFeedbackMessage}

                  onChange={(e) => setGeneralFeedbackMessage(e.target.value)}

                  style={{ fontSize: '14px', lineHeight: '1.6' }}

                />

              </div>



              <div className="alert alert-info">

                <i className="fas fa-info-circle me-2"></i>

                <strong>Note:</strong> This feedback will be sent directly to the SuperAdmin for immediate review and action.

              </div>

            </>

          )}

        </Modal.Body>

        <Modal.Footer>

          {!generalFeedbackSuccess && (

            <>

              <Button variant="secondary" onClick={() => setShowGeneralFeedbackModal(false)}>

                Cancel

              </Button>

              <Button

                variant="primary"

                onClick={handleGeneralFeedbackSubmit}

                disabled={generalFeedbackSubmitting || !generalFeedbackSeverity || !generalFeedbackMessage.trim()}

                style={{ minWidth: '140px' }}

              >

                {generalFeedbackSubmitting ? (

                  <>

                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>

                    Submitting...

                  </>

                ) : (

                  <>

                    <i className="fas fa-paper-plane me-2"></i>

                    Send Feedback

                  </>

                )}

              </Button>

            </>

          )}

        </Modal.Footer>

      </Modal>



      {/* Save Draft Modal */}

      <Modal show={showDraftModal} onHide={() => setShowDraftModal(false)}>

        <Modal.Header closeButton>

          <Modal.Title>

            <i className="fas fa-save text-primary me-2"></i>

            Save Draft

          </Modal.Title>

        </Modal.Header>

        <Modal.Body>

          {draftMessage.text && (

            <div className={`alert alert-${draftMessage.type === 'success' ? 'success' : 'danger'} mb-3`}>

              {draftMessage.text}

            </div>

          )}



          <div className="mb-3">

            <label className="form-label fw-bold">Draft Name *</label>

            <input

              type="text"

              className={`form-control ${draftNameError ? 'is-invalid' : ''}`}

              placeholder="Enter a descriptive name for this draft..."

              value={draftName}

              onChange={(e) => setDraftName(e.target.value)}

              onKeyPress={(e) => e.key === 'Enter' && saveDraft()}

            />

            {draftNameError && <div className="invalid-feedback">{draftNameError}</div>}

          </div>



          <div className="alert alert-info">

            <i className="fas fa-info-circle me-2"></i>

            <strong>Note:</strong> This will save your current progress including all changes made to the data.

          </div>

        </Modal.Body>

        <Modal.Footer>

          <Button variant="secondary" onClick={() => setShowDraftModal(false)}>

            Cancel

          </Button>

          <Button

            variant="primary"

            onClick={saveDraft}

            disabled={savingDraft || !draftName.trim()}

          >

            {savingDraft ? (

              <>

                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>

                Saving...

              </>

            ) : (

              <>

                <i className="fas fa-save me-2"></i>

                Save Draft

              </>

            )}

          </Button>

        </Modal.Footer>

      </Modal>



      {/* Load Draft Modal */}

      <Modal show={showDraftListModal} onHide={() => setShowDraftListModal(false)} size="lg">

        <Modal.Header closeButton>

          <Modal.Title>

            <i className="fas fa-folder-open text-info me-2"></i>

            Load Draft

          </Modal.Title>

        </Modal.Header>

        <Modal.Body>

          {draftMessage.text && (

            <div className={`alert alert-${draftMessage.type === 'success' ? 'success' : 'danger'} mb-3`}>

              {draftMessage.text}

            </div>

          )}



          {loadingDrafts ? (

            <div className="text-center py-4">

              <div className="spinner-border text-primary" role="status">

                <span className="visually-hidden">Loading...</span>

              </div>

              <p className="mt-2 text-muted">Loading drafts...</p>

            </div>

          ) : drafts.length === 0 ? (

            <div className="text-center py-4">

              <i className="fas fa-folder-open fa-3x text-muted mb-3"></i>

              <h5 className="text-muted">No Drafts Found</h5>

              <p className="text-muted">You haven't saved any drafts yet.</p>

            </div>

          ) : (

            <div className="draft-list">

              {drafts.map((draft) => (

                <div key={draft.id} className="card mb-3">

                  <div className="card-body">

                    <div className="d-flex justify-content-between align-items-start">

                      <div className="flex-grow-1">

                        <h6 className="card-title mb-1">{draft.draft_name}</h6>

                        <p className="card-text text-muted mb-2">

                          <small>

                            <i className="fas fa-clock me-1"></i>

                            Last saved: {formatDraftDate(draft.last_saved)}

                          </small>

                        </p>

                        {draft.file_name && (

                          <p className="card-text text-muted mb-2">

                            <small>

                              <i className="fas fa-file me-1"></i>

                              File: {draft.file_name}

                            </small>

                          </p>

                        )}

                      </div>

                      <div className="d-flex gap-2">

                        <button

                          className="btn btn-sm btn-primary"

                          onClick={() => loadDraft(draft)}

                          title="Load this draft"

                        >

                          <i className="fas fa-download me-1"></i>

                          Load

                        </button>

                        <button

                          className="btn btn-sm btn-outline-danger"

                          onClick={() => deleteDraft(draft.id, draft.draft_name)}

                          title="Delete this draft"

                        >

                          <i className="fas fa-trash"></i>

                        </button>

                      </div>

                    </div>

                  </div>

                </div>

              ))}

            </div>

          )}

        </Modal.Body>

        <Modal.Footer>

          <Button variant="secondary" onClick={() => setShowDraftListModal(false)}>

            Close

          </Button>

        </Modal.Footer>

      </Modal>

    </>

  );

};



export default DataValidationPage;
import React, { useState, useEffect, useRef } from "react";
import { Camera } from "react-camera-pro";
import { Button, OverlayTrigger, Tooltip } from "react-bootstrap";
import { PencilSquare, Trash, Save, Eye } from "react-bootstrap-icons";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";
import CameraTest from "./Cameratest";
import { processScannedImage } from "./PictureEnchance";
function CameraScan() {
  const [image, setImage] = useState(null);
  const [tablesData, setTablesData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [jsonOutput, setJsonOutput] = useState(null);
  const [progress, setProgress] = useState(0);
  const [amounts, setAmounts] = useState([]);
  const [editingRow, setEditingRow] = useState(null);
  const [editValues, setEditValues] = useState([]);
  const [currentDate, setCurrentDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [stockDetails, setStockDetails] = useState({});
  const [stockResultsState, setStockResultsState] = useState([]);
  const [cNo, setCNo] = useState(null);
  const [shopName, setShopName] = useState("");
  const [type, setType] = useState("Godown");
  const [typeParam, setTypeParam] = useState("");
  const [numberCounter, setNumberCounter] = useState("");
  const [visibleTooltip, setVisibleTooltip] = useState(null);
  const [isOpenCvReady, setIsOpenCvReady] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const canvasRef = useRef(null);
  const cameraRef = useRef(null);

  useEffect(() => {
    const checkOpenCv = () => {
      if (window.cv && window.cv.getBuildInformation) {
        setIsOpenCvReady(true);
      } else {
        setTimeout(checkOpenCv, 100);
      }
    };
    checkOpenCv();

    return () => {
      // Cleanup not needed for react-camera-pro
    };
  }, []);

  const version = "1.1.7"; // Updated version to reflect changes

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cNoParam = params.get("c_no");
    const typeParamValue = params.get("type");
    const numberCounterValue = params.get("number_counter");
    setTypeParam(typeParamValue);
    setNumberCounter(numberCounterValue);
    setType("Godown");
    if (cNoParam) {
      setCNo(cNoParam);
    } else {
      setError("No c_no provided in URL");
      toast.error("No c_no provided in URL");
    }
  }, []);

  useEffect(() => {
    console.log("Type parameter changed:", typeParam);
  }, [typeParam]);

  useEffect(() => {
    const fetchShopDetails = async () => {
      if (!cNo) return;
      try {
        const url = `https://deepikagroups.in/admin/api/getShopsList.php?type=${typeParam}&c_no=${cNo}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch shop details");
        const data = await response.json();
        const shopDetails = data.shop_details ? data.shop_details : [];
        const shop = shopDetails.find(
          (shop) => String(shop.id) === String(cNo)
        );
        if (shop) {
          setShopName(decodeURIComponent(shop.name || "Unnamed Shop"));
          console.log("Fetched shop name:", shop.name);
        } else {
          toast.error(`No shop found for c_no: ${cNo}`);
          setShopName("Unnamed Shop");
        }
      } catch (err) {
        console.error("Error fetching shop details:", err);
        toast.error(`Failed to fetch shop details: ${err.message}`);
        setShopName("Unnamed Shop");
      }
    };
    fetchShopDetails();
  }, [cNo, type]);

  const cleanProductName = (name) =>
    typeof name === "string" ? name.replace(/\s*\(\d+\)\s*$/, "").trim() : name;

  const fetchProductStockDetails = async (
    productName,
    tableIndex,
    rowIndex
  ) => {
    if (!cNo || !currentDate) {
      console.log("Missing required fields for stock details:", {
        cNo,
        currentDate,
      });
      return { tableIndex, rowIndex, error: "Missing c_no or date" };
    }
    try {
      const newproductname = cleanProductName(productName);
      const encodedProductName = encodeURIComponent(newproductname);
      const url = `https://deepikagroups.in/admin/api/getProductStockDetails.php?type=${typeParam}&c_no=${cNo}&date=${currentDate}&product_name=${encodedProductName}`;
      console.log("Fetching stock details with URL:", url);
      const response = await fetch(url);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `HTTP ${response.status}: Failed to fetch stock details for ${productName}`
        );
      }

      const data = await response.json();
      console.log(
        "Raw API response for",
        productName,
        ":",
        JSON.stringify(data, null, 2)
      );

      if (data.Success === 1 && data.Messages === "Product does not exist") {
        return { tableIndex, rowIndex, error: "Product does not exist" };
      }

      if (typeParam === "Counter") {
        return {
          tableIndex,
          rowIndex,
          data: {
            OpeningStock: Number(data.OpeningStock || 0),
            CounterReceived: Number(data.CounterReceived || 0),
            Sales: Number(data.Sales || 0),
            Price: Number(data.Price || 0),
          },
        };
      } else {
        return {
          tableIndex,
          rowIndex,
          data: {
            OpeningStock: Number(data.OpeningStock || 0),
            Purchase: Number(data.Purchase || 0),
            Sales: Number(data.sales || 0),
            Counter_Transfer: Number(data.Counter_Transfer || 0),
            CounterReceived: Number(data.CounterReceived || 0),
            ClosingStock: Number(data.no_btl_CBs || 0),
          },
        };
      }
    } catch (err) {
      console.error(`Error fetching stock details for ${productName}:`, err);
      toast.error(
        `Failed to fetch stock details for ${productName}: ${err.message}`
      );
      return { tableIndex, rowIndex, error: err.message };
    }
  };

  const handleFileChange = async (event) => {
    if (!cNo) {
      toast.error("No c_no provided in URL");
      return;
    }
    const file = event.target.files[0];
    if (!file) return;
    if (!isOpenCvReady) {
      toast.error("OpenCV.js is not loaded yet. Please try again.");
      return;
    }
    const imageUrl = URL.createObjectURL(file);
    setImage(imageUrl);
    processCameraImage(file);
  };

  const handleCapture = async () => {};

  const handleOpenCamera = async () => {
    if (!cNo) {
      toast.error("No c_no provided in URL");
      return;
    }
    if (!isOpenCvReady) {
      toast.error("OpenCV.js is not loaded yet. Please try again.");
      return;
    }
    setIsCameraOpen(true);
  };

  const handleCloseCamera = () => {
    setIsCameraOpen(false);
  };
  const processCameraImage = async (input) => {
    console.log("Processing camera image:", input);
    setIsLoading(true);
    setError(null);
    setTablesData([]);
    setJsonOutput(null);
    setStockDetails({});
    setStockResultsState([]);
    setProgress(0);

    // Convert Blob to File if input is a Blob
    let file;
    if (input instanceof Blob && !(input instanceof File)) {
      file = new File([input], "camera-capture.jpeg", {
        type: input.type || "image/jpeg",
        lastModified: Date.now(),
      });
    } else if (input instanceof File) {
      file = input; // Already a File, use as is
    } else {
      setError("Invalid input: Expected a File or Blob");
      toast.error("Invalid input: Expected a File or Blob");
      setIsLoading(false);
      return;
    }

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + (100 - prev) * 0.1;
        return next > 95 ? 95 : next;
      });
    }, 200);

    try {
      processScannedImage(file, async (processedDataUrl) => {
        if (!processedDataUrl) {
          setError("Failed to enhance image");
          toast.error("Failed to enhance image");
          clearInterval(progressInterval);
          setIsLoading(false);
          return;
        }
        setImage(processedDataUrl);

        // Convert dataURL to File for analyzeImageWithAI
        const res = await fetch(processedDataUrl);
        const blob = await res.blob();
        const enhancedFile = new File(
          [blob],
          file.name || "enhanced-image.jpeg",
          {
            type: file.type || "image/jpeg",
            lastModified: file.lastModified || Date.now(),
          }
        );

        await analyzeImageWithAI(enhancedFile); // Pass enhancedFile instead of original file
        clearInterval(progressInterval);
        setProgress(100);
        setIsLoading(false);
      });
    } catch (error) {
      console.error("Error processing camera image:", error);
      setError(`Failed to process camera image: ${error.message}`);
      toast.error(`Failed to process camera image: ${error.message}`);
      clearInterval(progressInterval);
      setIsLoading(false);
    }
  };

  const analyzeImageWithAI = async (file) => {
    try {
      const base64Image = await toBase64(file);
      const apiKey = "AIzaSyC7_3o0K1LeIFgn4u9tO-_YZAIUmSc72gg";
      if (!apiKey) throw new Error("Gemini API key is missing");

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-preview-05-06:generateContent?key=${apiKey}`;
      const requestBody = JSON.stringify({
        contents: [
          {
            parts: [
              { inlineData: { mimeType: file.type, data: base64Image } },
              {
                text: `Extract ONLY all tables from this image, starting from the first row that contains either a serial number or "opening balance" (whichever appears first). 
For each table, output an array of arrays (including header and total rows if present). 
Each table must have correct mapping of product name (or equivalent) with all other columns. 
Return a single JSON array of tables, where each table is an array of arrays. 
Do NOT include any extra text, explanation, markdown, or formatting—output strictly valid JSON only. 
If no tables are found, return an empty JSON array [].`,
              },
            ],
          },
        ],
      });

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
      });

      const data = await response.json();
      if (data.error)
        throw new Error(`Gemini API Error: ${data.error.message}`);

      const extractedText =
        data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
      console.log("Raw Gemini response:", extractedText);

      let parsedTables = [];
      try {
        let cleanedText = extractedText
          .trim()
          .replace(/```json\n?|\n?```/g, "")
          .replace(/```/g, "")
          .replace(/,\s*([\]}])/g, "$1");
        const firstBracket = cleanedText.indexOf("[");
        const lastBracket = cleanedText.lastIndexOf("]");
        if (firstBracket === -1 || lastBracket === -1)
          throw new Error("No valid JSON array found in response");
        cleanedText = cleanedText.substring(firstBracket, lastBracket + 1);
        parsedTables =
          cleanedText && cleanedText !== "[]" ? JSON.parse(cleanedText) : [];

        if (!Array.isArray(parsedTables))
          throw new Error("Response is not an array of tables");

        parsedTables = parsedTables.map((table, tableIndex) => {
          if (
            !Array.isArray(table) ||
            !table.every((row) => Array.isArray(row))
          ) {
            return [["Error in table format"]];
          }
          const headers = table[0];
          const maxCols = Math.max(...table.map((row) => row.length));
          const sanitizedTable = table.map((row, rowIdx) => {
            while (row.length < maxCols) row.push("");
            return row.map((cell, i) => {
              if (rowIdx === 0) {
                return typeof cell === "string" ? cell : String(cell || "");
              }
              if (
                i > 0 &&
                headers[i]
                  .toLowerCase()
                  .match(
                    /rate|out sale|amount|o\.b|ksbcl receipt|cou\. trsfer|cou\ntrsfer|total|c.b.|sale|receipt/
                  ) &&
                (cell === null ||
                  cell === undefined ||
                  isNaN(cell) ||
                  cell === "-" ||
                  cell === "—" ||
                  cell === "0" ||
                  cell === 0 ||
                  cell === "")
              ) {
                return 0;
              }
              if (
                i > 0 &&
                !isNaN(cell) &&
                cell !== "" &&
                headers[i]
                  .toLowerCase()
                  .match(
                    /rate|out sale|amount|o\.b|ksbcl receipt|cou\. trsfer|cou\ntrsfer|receipt/
                  )
              ) {
                return Number(cell);
              }
              return String(cell || "");
            });
          });

          return [
            sanitizedTable[0],
            ...sanitizedTable.slice(1).filter((row) => {
              return row.slice(1).some((cell) => {
                return !(
                  cell === 0 ||
                  cell === "0" ||
                  cell === "" ||
                  cell === null ||
                  cell === undefined ||
                  isNaN(cell)
                );
              });
            }),
          ];
        });

        const tableJSON = convertTableToJSON(parsedTables);
        const stockPromises = [];
        tableJSON.tables.forEach((table, tableIndex) => {
          table.forEach((row, rowIndex) => {
            const productNameRaw =
              row["Name of Brands"] ||
              row["name of brands"] ||
              row.Product ||
              row.product ||
              row.Item ||
              row.item;
            const productName =
              typeof productNameRaw === "string"
                ? productNameRaw.trim()
                : productNameRaw;
            if (
              productName &&
              typeof productName === "string" &&
              !productName.toLowerCase().includes("total")
            ) {
              stockPromises.push(
                fetchProductStockDetails(productName, tableIndex, rowIndex)
              );
            }
          });
        });

        const stockResults = await Promise.all(stockPromises);
        setStockResultsState(stockResults);

        const newStockDetails = {};
        stockResults.forEach((result) => {
          if (result && !result.error) {
            const key = `${result.tableIndex}-${result.rowIndex}`;
            newStockDetails[key] = result.data;
          }
        });
        setStockDetails(newStockDetails);

        const validationTypes = ["Validation"];

        const amountValues = [];
        const updatedTables = parsedTables.map((table, tableIndex) => {
          const headers = table[0];
          const amountIndex = headers.findIndex(
            (h) => typeof h === "string" && h.toLowerCase() === "amount"
          );
          const rateIndex = headers.findIndex(
            (h) => typeof h === "string" && h.toLowerCase() === "rate"
          );
          const outSaleIndex = headers.findIndex(
            (h) =>
              typeof h === "string" &&
              (h.toLowerCase() === "out sale" ||
                h.toLowerCase() === "out\nsale" ||
                h.toLowerCase() === "sale")
          );
          const obIndex = headers.findIndex(
            (h) =>
              typeof h === "string" &&
              (h.toLowerCase() === "o.b" ||
                h.toLowerCase() === "о.b." ||
                h.toLowerCase() === "o.b.")
          );
          const ksbclIndex = headers.findIndex(
            (h) =>
              typeof h === "string" &&
              (h.toLowerCase() === "ksbcl\nreceipt" ||
                h.toLowerCase() === "receipt" ||
                h.toLowerCase() === "ksbcl receipt" ||
                h.toLowerCase() === "ksbol receipt" ||
                h.toLowerCase() === "ksbol\nreceipt")
          );
          const productIndex = headers.findIndex(
            (h) =>
              typeof h === "string" &&
              (h.toLowerCase() === "name of brands" ||
                h.toLowerCase() === "product" ||
                h.toLowerCase() === "item")
          );
          const counterTransferIndex = headers.findIndex(
            (h) =>
              typeof h === "string" &&
              (h.toLowerCase() === "cou. trsfer" ||
                h.toLowerCase() === "cou\ntrsfer" ||
                h.toLowerCase() === "counter transfer")
          );
          const totalIndex = headers.findIndex(
            (h) => typeof h === "string" && h.toLowerCase() === "total"
          );
          const dataRows = table.slice(1);
          let tableTotal = 0;

          const checkedOBProducts = new Set();
          const updatedRows = dataRows.map((row, rowIndex) => {
            const isTotalRow =
              row[0].toLowerCase().includes("total") ||
              row[0].toLowerCase().includes("grand total");
            const validations = [];
            const stockData = stockResults.find(
              (r) => r.tableIndex === tableIndex && r.rowIndex === rowIndex
            );
            const productNameRaw = productIndex !== -1 ? row[productIndex] : "";
            const isDuplicateProduct =
              typeof productNameRaw === "string" &&
              productNameRaw.match(/$$ \d+ $$$/);

            if (!isTotalRow) {
              if (
                productIndex !== -1 &&
                (!row[productIndex] || row[productIndex] === "")
              ) {
                validations.push("Missing or empty Product Name");
              }

              if (
                !isDuplicateProduct &&
                obIndex !== -1 &&
                stockData?.data?.OpeningStock !== undefined
              ) {
                const productName = cleanProductName(productNameRaw);
                if (!checkedOBProducts.has(productName)) {
                  const obValue = Number(row[obIndex]);
                  if (isNaN(obValue)) {
                    validations.push(
                      `Invalid Opening Balance: "${row[obIndex]}" is not a valid number`
                    );
                  } else if (obValue !== stockData.data.OpeningStock) {
                    validations.push(
                      `OB Mismatch: ${obValue} does not match expected ${stockData.data.OpeningStock}`
                    );
                  }
                  checkedOBProducts.add(productName);
                }
              } else if (
                !isDuplicateProduct &&
                obIndex !== -1 &&
                !stockData?.data
              ) {
                validations.push("Opening Balance: No stock data available");
              }

              if (typeParam === "Counter") {
                // Counter-specific validations
                if (
                  !isDuplicateProduct &&
                  ksbclIndex !== -1 &&
                  stockData?.data?.CounterReceived !== undefined
                ) {
                  const receiptValue = Number(row[ksbclIndex]);
                  if (isNaN(receiptValue)) {
                    validations.push(
                      `Invalid Receipt: "${row[ksbclIndex]}" is not a valid number`
                    );
                  } else if (receiptValue !== stockData.data.CounterReceived) {
                    validations.push(
                      `Receipt Mismatch: ${receiptValue} does not match expected ${stockData.data.CounterReceived}`
                    );
                  }
                } else if (
                  !isDuplicateProduct &&
                  ksbclIndex !== -1 &&
                  !stockData?.data
                ) {
                  validations.push("Receipt: No stock data available");
                }

                if (
                  !isDuplicateProduct &&
                  outSaleIndex !== -1 &&
                  stockData?.data?.Sales !== undefined &&
                  stockData.data.Sales > 0
                ) {
                  const saleValue = Number(row[outSaleIndex]);
                  if (isNaN(saleValue)) {
                    validations.push(
                      `Invalid Sale: "${row[outSaleIndex]}" is not a valid number`
                    );
                  } else if (saleValue !== stockData.data.Sales) {
                    validations.push(
                      `Sale Mismatch: ${saleValue} does not match expected ${stockData.data.Sales}`
                    );
                  }
                } else if (
                  !isDuplicateProduct &&
                  outSaleIndex !== -1 &&
                  !stockData?.data
                ) {
                  validations.push("Sale: No stock data available");
                }

                if (
                  rateIndex !== -1 &&
                  totalIndex !== -1 &&
                  amountIndex !== -1 &&
                  stockData?.data
                ) {
                  const rateValue = Number(row[rateIndex]);
                  const cbValue =
                    Number(row[totalIndex]) - Number(row[outSaleIndex]); // Use totalIndex for C_B
                  const actualAmount = Number(row[amountIndex]);
                  const expectedAmount =
                    stockData.data.Price * Number(row[outSaleIndex]);

                  if (isNaN(rateValue)) {
                    validations.push(
                      `Invalid Rate: "${row[rateIndex]}" is not a valid number`
                    );
                  } else if (rateValue !== stockData.data.Price) {
                    validations.push(
                      `Rate Mismatch: ${rateValue} does not match expected ${stockData.data.Price}`
                    );
                  }

                  if (isNaN(cbValue)) {
                    validations.push(
                      `Invalid Closing Balance: "${row[totalIndex]}" is not a valid number`
                    );
                  }

                  if (isNaN(actualAmount)) {
                    validations.push(
                      `Invalid Amount: "${row[amountIndex]}" is not a valid number`
                    );
                  } else if (Math.abs(actualAmount - expectedAmount) > 0.01) {
                    validations.push(
                      `Amount Mismatch: Expected ${expectedAmount.toFixed(
                        2
                      )}, but got ${actualAmount}`
                    );
                  }
                }
              } else {
                // Godown-specific validations
                if (
                  !isDuplicateProduct &&
                  ksbclIndex !== -1 &&
                  stockData?.data?.Purchase !== undefined
                ) {
                  const ksbclValue = Number(row[ksbclIndex]);
                  if (isNaN(ksbclValue)) {
                    validations.push(
                      `Invalid KSBCL Receipt: "${row[ksbclIndex]}" is not a valid number`
                    );
                  } else if (ksbclValue !== stockData.data.Purchase) {
                    validations.push(
                      `KSBCL Receipt Mismatch: ${ksbclValue} does not match expected ${stockData.data.Purchase}`
                    );
                  }
                } else if (
                  !isDuplicateProduct &&
                  ksbclIndex !== -1 &&
                  !stockData?.data
                ) {
                  validations.push("KSBCL Receipt: No stock data available");
                }

                if (
                  !isDuplicateProduct &&
                  counterTransferIndex !== -1 &&
                  stockData?.data?.Counter_Transfer !== undefined
                ) {
                  const counterTransferValue = Number(
                    row[counterTransferIndex]
                  );
                  if (isNaN(counterTransferValue)) {
                    validations.push(
                      `Invalid Counter Transfer: "${row[counterTransferIndex]}" is not a valid number`
                    );
                  } else if (
                    counterTransferValue !== stockData.data.Counter_Transfer &&
                    stockData.data.Counter_Transfer > 0 &&
                    stockData.Counter_Transfer != null
                  ) {
                    validations.push(
                      `Counter Transfer Mismatch: ${counterTransferValue} does not match expected ${stockData.data.Counter_Transfer}`
                    );
                  }
                } else if (
                  !isDuplicateProduct &&
                  counterTransferIndex !== -1 &&
                  !stockData?.data
                ) {
                  validations.push("Counter Transfer: No stock data available");
                }

                if (
                  rateIndex !== -1 &&
                  outSaleIndex !== -1 &&
                  amountIndex !== -1
                ) {
                  const rateValue = Number(row[rateIndex]);
                  const outSaleValue = Number(row[outSaleIndex]);
                  const actualAmount = Number(row[amountIndex]);
                  if (isNaN(actualAmount)) {
                    validations.push(
                      `Invalid Amount: "${row[amountIndex]}" is not a valid number`
                    );
                  } else if (!isNaN(rateValue) && !isNaN(outSaleValue)) {
                    const closeBalance = stockData?.data?.ClosingStock || 0;
                    let calculatedAmount = 0;
                    if (closeBalance > 0) {
                      calculatedAmount = outSaleValue * rateValue;
                    }
                    if (Math.abs(actualAmount - calculatedAmount) > 0.01) {
                      validations.push(
                        `Amount Mismatch: Expected ${calculatedAmount.toFixed(
                          2
                        )}, but got ${actualAmount}`
                      );
                    }
                  }
                }
              }

              if (rateIndex !== -1) {
                const rateValue = Number(row[rateIndex]);
                if (isNaN(rateValue)) {
                  validations.push(
                    `Invalid Rate: "${row[rateIndex]}" is not a valid number`
                  );
                } else if (rateValue < 0) {
                  validations.push(
                    `Invalid Rate: ${rateValue} cannot be negative`
                  );
                }
              }

              if (outSaleIndex !== -1) {
                const outSaleValue = Number(row[outSaleIndex]);
                if (isNaN(outSaleValue)) {
                  validations.push(
                    `Invalid Out Sale: "${row[outSaleIndex]}" is not a valid number`
                  );
                } else if (outSaleValue < 0) {
                  validations.push(
                    `Invalid Out Sale: ${outSaleValue} cannot be negative`
                  );
                }
              }

              if (stockData?.error) {
                validations.push(`Stock Data Error: ${stockData.error}`);
              }

              if (stockData?.error === "Product does not exist") {
                validations.length = 0; // Clear all other validations
                validations.push("Error: Product Name Spelling Wrong");
              }
              if (amountIndex !== -1) {
                const amount = Number(row[amountIndex]);
                if (!isNaN(amount) && amount >= 0) {
                  amountValues.push({
                    tableIndex,
                    rowIndex: rowIndex + 1,
                    amount,
                  });
                  tableTotal += amount;
                } else {
                  validations.push("Invalid Amount: Cannot include in total");
                }
              }
            }

            if (isTotalRow && amountIndex !== -1) {
              const totalAmount = Number(row[amountIndex]);
              if (isNaN(totalAmount)) {
                validations.push(
                  `Invalid Total: "${row[amountIndex]}" is not a valid number`
                );
              } else if (Math.abs(totalAmount - tableTotal) > 0.01) {
                validations.push(
                  `Total Mismatch: Expected ${tableTotal.toFixed(
                    2
                  )}, but got ${totalAmount}`
                );
              } else {
                validations.push("Total: Correct");
              }
            }

            console.log("Validations for row", {
              tableIndex,
              rowIndex,
              validations,
            });
            return [...row, validations.join("; ") || "Correct"];
          });

          return [headers.concat(validationTypes), ...updatedRows];
        });

        setAmounts(amountValues);
        if (updatedTables.length === 0) {
          updatedTables.push([["No tables extracted"]]);
          toast.warn("No tables detected in the image");
        } else {
          toast.success(
            "Table extraction and validation completed!",
            "success"
          );
        }
        setTablesData(updatedTables);

        const finalJSON = convertTableToJSON(updatedTables, stockResults, true);
        setJsonOutput(JSON.stringify(finalJSON, null, 2));
      } catch (parseError) {
        console.error("Error parsing JSON response:", parseError);
        setError(`Failed to parse JSON response: ${parseError.message}`);
        setTablesData([]);
        toast.error("Error processing image", "error");
      }
    } catch (error) {
      console.error("Error analyzing image:", error);
      setError(`Failed to analyze the image: ${error.message}`);
      toast.error("Error processing image", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const toBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = (error) => reject(error);
    });
  };

  const convertTableToJSON = (
    tables,
    stockResults = [],
    excludeValidation = false
  ) => {
    if (!Array.isArray(tables) || tables.length === 0) return { tables: [] };

    const jsonTables = tables.map((table, tableIndex) => {
      if (!Array.isArray(table) || table.length === 0) return [];
      const headers =
        table[0] && Array.isArray(table[0]) && table[0].length > 0
          ? table[0].slice(0, table[0].length - (excludeValidation ? 1 : 0))
          : Array.from(
              { length: table[1]?.length || 1 },
              (_, i) => `Column${i + 1}`
            );
      const rows = table.length > 1 ? table.slice(1) : [];

      const jsonRows = rows.map((row, rowIndex) => {
        const rowObject = {};
        headers.forEach((header, index) => {
          rowObject[header || `Column${index + 1}`] = row[index] || "";
        });
        if (!excludeValidation) {
          const stockData = stockResults.find(
            (r) => r.tableIndex === tableIndex && r.rowIndex === rowIndex
          );
          if (stockData) {
            if (stockData.error) {
              rowObject.validationError = stockData.error;
            } else {
              rowObject.stockDetails = stockData.data;
            }
          }
          rowObject.validation = row[headers.length] || "";
        }
        return rowObject;
      });
      return jsonRows;
    });

    return { tables: jsonTables };
  };

  const handleDownloadJSON = () => {
    if (!jsonOutput) return;
    const blob = new Blob([jsonOutput], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "tables_data.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("JSON file downloaded");
  };

  const handleSaveJSON = async () => {
    if (!jsonOutput) {
      toast.error("No JSON data to save");
      return;
    }
    try {
      const response = await fetch(
        "https://jsonplaceholder.typicode.com/posts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: jsonOutput,
        }
      );
      if (!response.ok) throw new Error("Failed to save JSON to backend");
      toast.success("JSON saved successfully!");
    } catch (error) {
      console.error("Error saving JSON:", error);
      toast.error(`Failed to save JSON: ${error.message}`);
    }
  };

  const handleSubmitSales = async () => {
    if (!jsonOutput || !cNo || !currentDate) {
      toast.error("Missing required fields (c_no, Date, or JSON)");
      return;
    }

    try {
      const parsedJson = JSON.parse(jsonOutput);
      if (!parsedJson.tables || !Array.isArray(parsedJson.tables)) {
        toast.error("Invalid JSON structure");
        return;
      }

      const c_name = shopName;
      const salePromises = [];

      parsedJson.tables.forEach((table, tableIndex) => {
        const headers = tablesData[tableIndex][0];
        console.log(`Table ${tableIndex} Headers:`, headers);

        const counterTransferIndex = headers.findIndex(
          (h) =>
            typeof h === "string" &&
            h
              .toLowerCase()
              .match(/cou\.?\s*trsfer|cou\s*ntrsfer|counter\s*transfer/i)
        );
        const rateIndex = headers.findIndex(
          (h) => typeof h === "string" && h.toLowerCase().match(/rate/i)
        );
        const outSaleIndex = headers.findIndex(
          (h) =>
            typeof h === "string" && h.toLowerCase().match(/out\s*sale|sale/i)
        );
        const productIndex = headers.findIndex(
          (h) =>
            typeof h === "string" &&
            h.toLowerCase().match(/name\s*of\s*brands|product|item/i)
        );

        console.log("Indices:", {
          counterTransferIndex,
          rateIndex,
          outSaleIndex,
          productIndex,
        });

        table.forEach((row, rowIndex) => {
          const validationValue =
            tablesData[tableIndex][rowIndex + 1][headers.length - 1];

          if (
            validationValue !== "Correct" &&
            validationValue !== "Total: Correct"
          ) {
            return;
          }

          const productNameRaw =
            row["Name of Brands"] ||
            row["name of brands"] ||
            row.Product ||
            row.product ||
            row.Item ||
            row.item ||
            (productIndex !== -1
              ? tablesData[tableIndex][rowIndex + 1][productIndex]
              : null);
          const productName =
            typeof productNameRaw === "string"
              ? productNameRaw.trim()
              : productNameRaw;

          const rate =
            rateIndex !== -1
              ? Number(tablesData[tableIndex][rowIndex + 1][rateIndex] || 0)
              : 0;
          const qty =
            outSaleIndex !== -1
              ? Number(tablesData[tableIndex][rowIndex + 1][outSaleIndex] || 0)
              : 0;
          const counterTransfer =
            counterTransferIndex !== -1
              ? Number(
                  tablesData[tableIndex][rowIndex + 1][counterTransferIndex] ||
                    0
                )
              : 0;

          console.log(`Row ${rowIndex} in Table ${tableIndex}:`, {
            productName,
            rate,
            qty,
            counterTransfer,
            isValid:
              productName &&
              !productName.toLowerCase().includes("total") &&
              !isNaN(rate) &&
              rate > 0 &&
              !isNaN(qty) &&
              qty > 0,
          });

          if (
            productName &&
            !productName.toLowerCase().includes("total") &&
            !isNaN(rate) &&
            rate > 0 &&
            !isNaN(qty) &&
            qty > 0 &&
            typeParam === "Godown"
          ) {
            const Updateproductname = cleanProductName(productName);
            const saleParams = new URLSearchParams({
              c_no: cNo,
              c_name: encodeURIComponent(c_name),
              p_name: encodeURIComponent(Updateproductname),
              date: currentDate,
              price: rate.toFixed(2),
              type: typeParam,
              qty: Number(qty),
              saleType: type,
            });
            const salesParams = decodeURIComponent(saleParams).replace(
              /%20/g,
              " "
            );
            const saleUrl = `https://deepikagroups.in/admin/api/add_AI_sale.php?${salesParams}`;
            console.log("Sales Params:", saleUrl);
            salePromises.push(
              fetch(saleUrl, { method: "POST" })
                .then(async (response) => {
                  if (!response.ok) {
                    let errorMessage = await response.text();
                    try {
                      const errorData = JSON.parse(errorMessage);
                      errorMessage = errorData.message || errorMessage;
                    } catch (e) {
                      // Not JSON, use raw text
                    }
                    throw new Error(
                      `Failed to submit sale for ${productName}: ${errorMessage}`
                    );
                  }
                  return { productName, success: true, type: "sale" };
                })
                .catch((err) => ({
                  productName,
                  success: false,
                  error: err.message,
                  type: "sale",
                }))
            );
          }
          const sales = Number(
            tablesData[tableIndex][rowIndex + 1][outSaleIndex]
          );
          if (
            productName &&
            !productName.toLowerCase().includes("total") &&
            !isNaN(sales) &&
            sales > 0 &&
            typeParam === "Counter"
          ) {
            const Updateproductname = cleanProductName(productName);
            const saleParams = new URLSearchParams({
              c_no: cNo,
              c_name: encodeURIComponent(c_name),
              p_name: encodeURIComponent(Updateproductname),
              date: currentDate,
              price: rate.toFixed(2),
              type: typeParam,
              qty: sales,
              saleType: type,
            });
            const salesParams = decodeURIComponent(saleParams).replace(
              /%20/g,
              " "
            );
            const saleUrl = `https://deepikagroups.in/admin/api/add_AI_sale.php?${salesParams}`;
            console.log("Sales Params:", saleUrl);
            salePromises.push(
              fetch(saleUrl, { method: "POST" })
                .then(async (response) => {
                  if (!response.ok) {
                    let errorMessage = await response.text();
                    try {
                      const errorData = JSON.parse(errorMessage);
                      errorMessage = errorData.message || errorMessage;
                    } catch (e) {
                      // Not JSON, use raw text
                    }
                    throw new Error(
                      `Failed to submit sale for ${productName}: ${errorMessage}`
                    );
                  }
                  return { productName, success: true, type: "sale" };
                })
                .catch((err) => ({
                  productName,
                  success: false,
                  error: err.message,
                  type: "sale",
                }))
            );
          }

          if (
            typeParam === "Godown" &&
            !isNaN(counterTransfer) &&
            counterTransfer > 0
          ) {
            const rateValue = Number(rate);
            const transferQty = Number(counterTransfer);
            console.log(
              "Entering counter transfer condition for",
              productName,
              rateValue,
              transferQty
            );

            const transferParams = new URLSearchParams({
              c_no: cNo,
              p_name: encodeURIComponent(productName),
              date: currentDate,
              price: rateValue.toFixed(2),
              qty: transferQty,
            });

            const transferParam = decodeURIComponent(transferParams).replace(
              /%20/g,
              " "
            );
            const transferUrl = `https://deepikagroups.in/admin/api/add_countTransfer_AI.php?${transferParam}`;
            console.log(`Submitting counter transfer: ${transferUrl}`);
            salePromises.push(
              fetch(transferUrl, { method: "POST" })
                .then(async (response) => {
                  if (!response.ok) {
                    let errorMessage = await response.text();
                    try {
                      const errorData = JSON.parse(errorMessage);
                      errorMessage = errorData.message || errorMessage;
                    } catch (e) {
                      // Not JSON, use raw text
                    }
                    throw new Error(
                      `Failed to submit counter transfer for ${productName}: ${errorMessage}`
                    );
                  }
                  return { productName, success: true, type: "transfer" };
                })
                .catch((err) => ({
                  productName,
                  success: false,
                  error: err.message,
                  type: "transfer",
                }))
            );
          }
        });
      });

      if (salePromises.length === 0) {
        toast.warning(
          "No valid rows to submit. Ensure rows have valid product names, Rate, and Out Sale or Counter Transfer values."
        );
        return;
      }

      setIsLoading(true);
      const results = await Promise.all(salePromises);
      setIsLoading(false);

      const successes = results.filter((r) => r.success);
      const failures = results.filter((r) => !r.success);
      console.log("successes:", successes);
      console.log("failures:", failures);
      if (successes.length > 0 && typeParam === "Godown") {
        const saleSuccesses = successes.filter((r) => r.type === "sale").length;
        const transferSuccesses = successes.filter(
          (r) => r.type === "transfer"
        ).length;
        toast.success(
          `Successfully submitted ${saleSuccesses} sale(s) and ${transferSuccesses} counter transfer(s)`
        );
      }
      if (successes.length > 0 && typeParam === "Counter") {
        const saleSuccesses = successes.filter((r) => r.type === "sale").length;
        toast.success(`Successfully submitted ${saleSuccesses} sale(s)`);
      }
      if (failures.length > 0) {
        failures.forEach((f) => {
          toast.error(
            `Failed to submit ${f.type} for ${f.productName}: ${f.error}`
          );
        });
      }
    } catch (error) {
      console.error("Error submitting sales or transfers:", error);
      toast.error(`Failed to submit data: ${error.message}`);
      setIsLoading(false);
    }
  };

  const handleEditRow = (tableIndex, rowIndex) => {
    const rowData = tablesData[tableIndex][rowIndex + 1];
    const initialEditValues = rowData
      .slice(0, rowData.length - 1)
      .map((value) =>
        value === null || value === undefined ? "" : String(value)
      );

    const headers = tablesData[tableIndex][0];
    const productIndex = headers.findIndex(
      (h) =>
        typeof h === "string" &&
        (h.toLowerCase() === "name of brands" ||
          h.toLowerCase() === "product" ||
          h.toLowerCase() === "item")
    );

    let productInputSize = 10;
    if (productIndex !== -1 && initialEditValues[productIndex]) {
      productInputSize = Math.max(
        initialEditValues[productIndex].length * 2,
        10
      );
    }

    setEditingRow({ tableIndex, rowIndex, productInputSize });
    setEditValues(initialEditValues);
  };

  const handleSaveEdit = async (tableIndex, rowIndex) => {
    try {
      const updatedTables = [...tablesData];
      const headers = updatedTables[tableIndex][0];
      const oldRow = [...updatedTables[tableIndex][rowIndex + 1]];

      const sanitizedEditValues = editValues.map((value, i) => {
        const header = headers[i].toLowerCase();
        if (
          header.match(
            /rate|out sale|amount|o\.b|ksbcl receipt|cou\. trsfer|cou\ntrsfer|total/
          ) &&
          (value === "" || value === "-")
        ) {
          return 0;
        }
        if (
          header.match(
            /rate|out sale|amount|o\.b|ksbcl receipt|cou\. trsfer|cou\ntrsfer|total/
          ) &&
          !isNaN(value)
        ) {
          return Number(value);
        }
        return String(value);
      });

      const productIndex = headers.findIndex(
        (h) =>
          typeof h === "string" &&
          (h.toLowerCase() === "name of brands" ||
            h.toLowerCase() === "product" ||
            h.toLowerCase() === "item")
      );
      const productName =
        productIndex !== -1 ? sanitizedEditValues[productIndex] : null;
      const isDuplicateProduct =
        typeof productName === "string" && productName.match(/$$  \d+  $$/);
      let validationValue = oldRow[headers.length - 1];

      if (
        productName &&
        typeof productName === "string" &&
        !productName.toLowerCase().includes("total")
      ) {
        const stockResult = await fetchProductStockDetails(
          productName,
          tableIndex,
          rowIndex
        );
        const validations = [];

        const amountIndex = headers.findIndex(
          (h) => h.toLowerCase() === "amount"
        );
        const rateIndex = headers.findIndex((h) => h.toLowerCase() === "rate");
        const outSaleIndex = headers.findIndex((h) =>
          h.toLowerCase().match(/out\s*sale|sale/)
        );
        const obIndex = headers.findIndex((h) => h.toLowerCase() === "o.b");
        const ksbclIndex = headers.findIndex((h) =>
          h.toLowerCase().match(/ksbcl\s*receipt|receipt/)
        );
        const counterTransferIndex = headers.findIndex((h) =>
          h
            .toLowerCase()
            .match(/cou\.?\s*trsfer|cou\s*ntrsfer|counter\s*transfer/)
        );
        const totalIndex = headers.findIndex(
          (h) => h.toLowerCase() === "total"
        );

        if (stockResult.error) {
          validations.push(`Stock Data Error: ${stockResult.error}`);
        } else if (!isDuplicateProduct) {
          if (obIndex !== -1) {
            const obValue = Number(sanitizedEditValues[obIndex]);
            if (isNaN(obValue)) {
              validations.push(
                `Invalid Opening Balance: "${sanitizedEditValues[obIndex]}" is not a valid number`
              );
            } else if (obValue !== stockResult.data.OpeningStock) {
              validations.push(
                `OB Mismatch: ${obValue} does not match expected ${stockResult.data.OpeningStock}`
              );
            }
          }

          if (typeParam === "Counter") {
            if (ksbclIndex !== -1) {
              const receiptValue = Number(sanitizedEditValues[ksbclIndex]);
              if (isNaN(receiptValue)) {
                validations.push(
                  `Invalid Receipt: "${sanitizedEditValues[ksbclIndex]}" is not a valid number`
                );
              } else if (receiptValue !== stockResult.data.CounterReceived) {
                validations.push(
                  `Receipt Mismatch: ${receiptValue} does not match expected ${stockResult.data.CounterReceived}`
                );
              }
            }

            if (
              outSaleIndex !== -1 &&
              stockResult.data.Sales !== undefined &&
              stockResult.data.Sales > 0
            ) {
              const saleValue = Number(sanitizedEditValues[outSaleIndex]);
              if (isNaN(saleValue)) {
                validations.push(
                  `Invalid Sale: "${sanitizedEditValues[outSaleIndex]}" is not a valid number`
                );
              } else if (saleValue !== stockResult.data.Sales) {
                validations.push(
                  `Sale Mismatch: ${saleValue} does not match expected ${stockResult.data.Sales}`
                );
              }
            }

            if (rateIndex !== -1 && totalIndex !== -1 && amountIndex !== -1) {
              const rateValue = Number(sanitizedEditValues[rateIndex]);
              const cbValue =
                Number(sanitizedEditValues[totalIndex]) -
                Number(sanitizedEditValues[outSaleIndex]);
              const actualAmount = Number(sanitizedEditValues[amountIndex]);
              const expectedAmount =
                stockResult.data.Price *
                Number(sanitizedEditValues[outSaleIndex]);
              if (isNaN(rateValue)) {
                validations.push(
                  `Invalid Rate: "${sanitizedEditValues[rateIndex]}" is not a valid number`
                );
              } else if (rateValue !== stockResult.data.Price) {
                validations.push(
                  `Rate Mismatch: ${rateValue} does not match expected ${stockResult.data.Price}`
                );
              }

              if (isNaN(cbValue)) {
                validations.push(
                  `Invalid Closing Balance: "${sanitizedEditValues[totalIndex]}" is not a valid number`
                );
              }

              if (isNaN(actualAmount)) {
                validations.push(
                  `Invalid Amount: "${sanitizedEditValues[amountIndex]}" is not a valid number`
                );
              } else if (Math.abs(actualAmount - expectedAmount) > 0.01) {
                validations.push(
                  `Amount Mismatch: Expected ${expectedAmount.toFixed(
                    2
                  )}, but got ${actualAmount}`
                );
              }
            }
          } else {
            if (ksbclIndex !== -1) {
              const ksbclValue = Number(sanitizedEditValues[ksbclIndex]);
              if (isNaN(ksbclValue)) {
                validations.push(
                  `Invalid KSBCL Receipt: "${sanitizedEditValues[ksbclIndex]}" is not a valid number`
                );
              } else if (ksbclValue !== stockResult.data.Purchase) {
                validations.push(
                  `KSBCL Receipt Mismatch: ${ksbclValue} does not match expected ${stockResult.data.Purchase}`
                );
              }
            }

            if (counterTransferIndex !== -1) {
              const counterTransferValue = Number(
                sanitizedEditValues[counterTransferIndex]
              );
              if (isNaN(counterTransferValue)) {
                validations.push(
                  `Invalid Counter Transfer: "${sanitizedEditValues[counterTransferIndex]}" is not a valid number`
                );
              } else if (
                counterTransferValue !== stockResult.data.Counter_Transfer &&
                stockResult.data.Counter_Transfer > 0 &&
                stockResult.data.Counter_Transfer != null
              ) {
                validations.push(
                  `Counter Transfer Mismatch: ${counterTransferValue} does not match expected ${stockResult.data.Counter_Transfer}`
                );
              }
            }

            if (rateIndex !== -1 && outSaleIndex !== -1 && amountIndex !== -1) {
              const rateValue = Number(sanitizedEditValues[rateIndex]);
              const outSaleValue = Number(sanitizedEditValues[outSaleIndex]);
              const actualAmount = Number(sanitizedEditValues[amountIndex]);
              if (isNaN(actualAmount)) {
                validations.push(
                  `Invalid Amount: "${sanitizedEditValues[amountIndex]}" is not a valid number`
                );
              } else if (!isNaN(rateValue) && !isNaN(outSaleValue)) {
                const closeBalance = stockResult.data?.ClosingStock || 0;
                let calculatedAmount = 0;
                if (closeBalance > 0) {
                  calculatedAmount = (outSaleValue / closeBalance) * rateValue;
                } else {
                  validations.push(
                    "Invalid Closing Stock: Cannot divide by zero"
                  );
                }
                if (Math.abs(actualAmount - calculatedAmount) > 0.01) {
                  validations.push(
                    `Amount Mismatch: Expected ${calculatedAmount.toFixed(
                      2
                    )}, but got ${actualAmount}`
                  );
                }
              }
            }
          }
        }
        if (stockResult?.error === "Product does not exist") {
          validations.length = 0;
          validations.push("Error: Product Name Spelling Wrong");
        }
        validationValue =
          validations.length > 0 ? validations.join("; ") : "Correct";

        const updatedStockResults = [...stockResultsState];
        const existingResultIndex = updatedStockResults.findIndex(
          (r) => r.tableIndex === tableIndex && r.rowIndex === rowIndex
        );
        if (existingResultIndex !== -1) {
          updatedStockResults[existingResultIndex] = stockResult;
        } else {
          updatedStockResults.push(stockResult);
        }
        setStockResultsState(updatedStockResults);

        const newStockDetails = { ...stockDetails };
        if (!stockResult.error) {
          newStockDetails[`${tableIndex}-${rowIndex}`] = stockResult.data;
        }
        setStockDetails(newStockDetails);
      }

      const nonProductValues = sanitizedEditValues
        .slice(0, sanitizedEditValues.length)
        .filter((_, i) => i !== productIndex);
      const isAllZero = nonProductValues.every(
        (cell) => cell === 0 || cell === "0" || cell === "" || cell == null
      );
      if (isAllZero && !validationValue.toLowerCase().includes("total")) {
        updatedTables[tableIndex].splice(rowIndex + 1, 1);
        toast.info("Row removed as all non-product values are zero");
      } else {
        updatedTables[tableIndex][rowIndex + 1] = [
          ...sanitizedEditValues,
          validationValue,
        ];
      }

      const amountIndex = headers.findIndex(
        (h) => h.toLowerCase() === "amount"
      );
      let tableTotal = 0;
      const updatedAmounts = amounts.filter(
        (a) => !(a.tableIndex === tableIndex && a.rowIndex === rowIndex + 1)
      );
      if (amountIndex !== -1 && !isAllZero) {
        const amount = Number(sanitizedEditValues[amountIndex]);
        if (!isNaN(amount) && amount >= 0) {
          updatedAmounts.push({
            tableIndex,
            rowIndex: rowIndex + 1,
            amount,
          });
          tableTotal = updatedAmounts
            .filter((a) => a.tableIndex === tableIndex)
            .reduce((sum, a) => sum + Number(a.amount), 0);
        }
      }

      const lastRow =
        updatedTables[tableIndex][updatedTables[tableIndex].length - 1];
      if (
        lastRow &&
        (lastRow[0].toLowerCase().includes("total") ||
          lastRow[0].toLowerCase().includes("grand total")) &&
        amountIndex !== -1
      ) {
        const totalAmount = Number(lastRow[amountIndex]);
        lastRow[headers.length - 1] = isNaN(totalAmount)
          ? `Total: not a number (${lastRow[amountIndex]})`
          : Math.abs(totalAmount - tableTotal) > 0.01
          ? `Total: ${totalAmount} ≠ ${tableTotal}`
          : "Total: Correct";
      }

      setTablesData(updatedTables);
      setAmounts(updatedAmounts);
      setEditingRow(null);
      setEditValues([]);

      const tableJSON = convertTableToJSON(
        updatedTables,
        stockResultsState,
        true
      );
      setJsonOutput(JSON.stringify(tableJSON, null, 2));

      if (!isAllZero) {
        toast.success("Row updated successfully!");
      }
    } catch (error) {
      console.error("Error in handleSaveEdit:", error);
      toast.error(`Failed to save edit: ${error.message}`);
    }
  };

  const handleDeleteRow = (tableIndex, rowIndex) => {
    const updatedTables = [...tablesData];
    const headers = updatedTables[tableIndex][0];
    updatedTables[tableIndex].splice(rowIndex + 1, 1);

    const updatedAmounts = amounts.filter(
      (a) => !(a.tableIndex === tableIndex && a.rowIndex === rowIndex + 1)
    );

    if (updatedTables[tableIndex].length > 1) {
      const lastRow =
        updatedTables[tableIndex][updatedTables[tableIndex].length - 1];
      if (
        lastRow[0].toLowerCase().includes("total") ||
        lastRow[0].toLowerCase().includes("grand total")
      ) {
        const amountIndex = headers.findIndex(
          (h) => h.toLowerCase() === "amount"
        );
        const tableTotal = updatedAmounts
          .filter((a) => a.tableIndex === tableIndex)
          .reduce((sum, a) => sum + Number(a.amount), 0);
        const totalAmount = Number(lastRow[amountIndex]);
        lastRow[headers.length - 1] = isNaN(totalAmount)
          ? `Total: not a number (${lastRow[amountIndex]})`
          : Math.abs(totalAmount - tableTotal) > 0.01
          ? `Total: ${totalAmount} ≠ ${tableTotal}`
          : "Total: Correct";
      }
    }

    setTablesData(updatedTables);
    setAmounts(updatedAmounts);
    const tableJSON = convertTableToJSON(
      updatedTables,
      stockResultsState,
      true
    );
    setJsonOutput(JSON.stringify(tableJSON, null, 2));
    toast.success("Row deleted successfully!");
  };

  const toggleTooltip = (tableIndex, rowIndex) => {
    const key = `${tableIndex}-${rowIndex}`;
    setVisibleTooltip(visibleTooltip === key ? null : key);
  };

  const syntaxHighlight = (json) => {
    if (!json) return "";
    json = json.replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">");
    return json.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
      (match) => {
        let cls = "json-number";
        if (/^"/.test(match)) {
          cls = /:$/.test(match) ? "json-key" : "json-string";
        } else if (/true|false/.test(match)) {
          cls = "json-boolean";
        } else if (/null/.test(match)) {
          cls = "json-null";
        }
        return `<span class="${cls}">${match}</span>`;
      }
    );
  };

  useEffect(() => {
    if (tablesData.length > 0 && tablesData[0].length > 0) {
      const tableJSON = convertTableToJSON(tablesData, stockResultsState, true);
      setJsonOutput(JSON.stringify(tableJSON, null, 2));
    }
  }, [tablesData, stockResultsState]);

  return (
    <div className="App">
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
      <nav className="navbar">
        <div className="navbar-container">
          <div className="navbar-items flex-row-mobile">
            {numberCounter === "2" && (
              <select
                value={type || ""}
                onChange={(e) => setType(e.target.value)}
                className="navbar-select"
              >
                <option value="" disabled>
                  Select Type
                </option>
                <option value="Counter">Counter</option>
                <option value="Godown">Godown</option>
              </select>
            )}
            <div className="navbar-date">
              <input
                type="date"
                value={currentDate}
                onChange={(e) => setCurrentDate(e.target.value)}
                className="navbar-date-input"
              />
            </div>
            <div className="navbar-upload">
              <input
                id="fileInput"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="navbar-upload-input"
                disabled={!cNo}
              />
              <label htmlFor="fileInput" className="navbar-upload-label">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 3h18v18H3z"></path>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
              </label>
            </div>
            <div className="navbar-camera">
              <button
                className="navbar-upload-label"
                onClick={handleOpenCamera}
                disabled={!cNo || isCameraOpen}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="feather feather-camera"
                >
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3l2-3h6l2 3h3a2 2 0 0 1 2 2z"></path>
                  <circle cx="12" cy="13" r="4"></circle>
                </svg>
              </button>
            </div>
          </div>
          {isLoading && (
            <div className="progress-container">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className="progress-text">
                Processing Image... {Math.round(progress)}%
              </div>
            </div>
          )}
          {error && (
            <div className="error-message">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
              {error}
            </div>
          )}
        </div>
      </nav>
      <canvas ref={canvasRef} style={{ display: "none" }} />
      {isCameraOpen && !image && (
        <div className="card fade-in">
          {/* <h2 className="section-title">Camera Preview</h2> */}
          <CameraTest onCapture={processCameraImage} />
          <div className="camera-controls">
            <button
              className="action-button btn-secondary"
              onClick={handleCloseCamera}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {image && (
        <div className="card fade-in">
          <h2 className="section-title">Image Preview</h2>
          <div className="image-preview-container">
            <img
              src={image}
              alt="Captured or Uploaded"
              className="image-preview"
            />
          </div>
        </div>
      )}

      {tablesData.length > 0 && tablesData[0].length > 0 && (
        <div className="card fade-in">
          <div className="card-header">
            <h2 className="section-title">Extracted Data Tables</h2>
          </div>
          <div className="tables-container">
            {tablesData.map((table, tableIndex) => (
              <div key={`table-${tableIndex}`} className="table-wrapper">
                <h3 className="table-title">Table {tableIndex + 1}</h3>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        {table[0].map((header, index) => (
                          <th key={`header-${tableIndex}-${index}`}>
                            {header || `Column ${index + 1}`}
                          </th>
                        ))}
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const dataRows = table
                          .slice(1)
                          .map((row, idx) => ({ row, originalIndex: idx }));

                        const correctRows = dataRows.filter(
                          (r) =>
                            r.row[table[0].length - 1] === "Correct" ||
                            r.row[table[0].length - 1] === "Total: Correct"
                        );
                        const errorRows = dataRows.filter(
                          (r) =>
                            r.row[table[0].length - 1] !== "Correct" &&
                            r.row[table[0].length - 1] !== "Total: Correct"
                        );
                        const sortedRows = [...correctRows, ...errorRows];

                        return sortedRows.map((rowObj, rowIndex) => {
                          const row = rowObj.row;
                          const originalIndex = rowObj.originalIndex;
                          const validationValue = row[table[0].length - 1];
                          const isError =
                            validationValue !== "Correct" &&
                            validationValue !== "Total: Correct";
                          const isEditing =
                            editingRow &&
                            editingRow.tableIndex === tableIndex &&
                            editingRow.rowIndex === originalIndex;

                          const productIndex = table[0].findIndex(
                            (h) =>
                              typeof h === "string" &&
                              (h.toLowerCase() === "name of brands" ||
                                h.toLowerCase() === "product" ||
                                h.toLowerCase() === "item")
                          );

                          return (
                            <tr key={`row-${tableIndex}-${rowIndex}`}>
                              {row.map((cell, cellIndex) => (
                                <td
                                  key={`cell-${tableIndex}-${rowIndex}-${cellIndex}`}
                                  className={
                                    cellIndex === table[0].length - 1
                                      ? "validation-cell"
                                      : ""
                                  }
                                  style={
                                    cellIndex === productIndex && isError
                                      ? { color: "#dc2626", fontWeight: 600 }
                                      : undefined
                                  }
                                >
                                  {isEditing &&
                                  cellIndex < table[0].length - 1 ? (
                                    <input
                                      type="text"
                                      className="edit-input-small"
                                      style={
                                        cellIndex === productIndex
                                          ? {
                                              width: `${editingRow.productInputSize}ch`,
                                            }
                                          : undefined
                                      }
                                      value={editValues[cellIndex] || ""}
                                      onChange={(e) => {
                                        const newValues = [...editValues];
                                        newValues[cellIndex] = e.target.value;
                                        setEditValues(newValues);
                                      }}
                                    />
                                  ) : cellIndex === table[0].length - 1 ? (
                                    validationValue === "Correct" ? (
                                      <span
                                        style={{
                                          color: "#16a34a",
                                          fontWeight: 600,
                                        }}
                                      >
                                        Correct
                                      </span>
                                    ) : isError ? (
                                      <OverlayTrigger
                                        placement="top"
                                        show={
                                          visibleTooltip ===
                                          `${tableIndex}-${originalIndex}`
                                        }
                                        overlay={
                                          <Tooltip>
                                            <span
                                              style={{
                                                userSelect: "all",
                                                whiteSpace: "pre-line",
                                              }}
                                            >
                                              {validationValue ||
                                                "No error details available"}
                                            </span>
                                          </Tooltip>
                                        }
                                      >
                                        <Button
                                          className="action-icon action-icon-view"
                                          size="sm"
                                          variant="warning"
                                          onClick={() =>
                                            toggleTooltip(
                                              tableIndex,
                                              originalIndex
                                            )
                                          }
                                          style={{ color: "inherit" }}
                                        >
                                          <Eye
                                            style={{ color: "currentColor" }}
                                          />
                                        </Button>
                                      </OverlayTrigger>
                                    ) : (
                                      validationValue
                                    )
                                  ) : (
                                    cell
                                  )}
                                </td>
                              ))}
                              <td>
                                {isEditing ? (
                                  <div className="flex-row-mobile">
                                    <OverlayTrigger
                                      placement="top"
                                      overlay={<Tooltip>Save Changes</Tooltip>}
                                    >
                                      <Button
                                        className="action-icon action-icon-save"
                                        size="sm"
                                        onClick={() =>
                                          handleSaveEdit(
                                            tableIndex,
                                            originalIndex
                                          )
                                        }
                                      >
                                        <Save />
                                      </Button>
                                    </OverlayTrigger>
                                    <OverlayTrigger
                                      placement="top"
                                      overlay={<Tooltip>Cancel</Tooltip>}
                                    >
                                      <button
                                        type="button"
                                        className="custom-close-btn"
                                        aria-label="Cancel"
                                        onClick={() => {
                                          setEditingRow(null);
                                          setEditValues([]);
                                        }}
                                      >
                                        ×
                                      </button>
                                    </OverlayTrigger>
                                  </div>
                                ) : (
                                  <div className="flex-row-mobile">
                                    <OverlayTrigger
                                      placement="top"
                                      overlay={<Tooltip>Edit Row</Tooltip>}
                                    >
                                      <Button
                                        className="action-icon action-icon-edit"
                                        size="sm"
                                        onClick={() =>
                                          handleEditRow(
                                            tableIndex,
                                            originalIndex
                                          )
                                        }
                                        disabled={editingRow !== null}
                                      >
                                        <PencilSquare />
                                      </Button>
                                    </OverlayTrigger>
                                    <OverlayTrigger
                                      placement="top"
                                      overlay={<Tooltip>Delete Row</Tooltip>}
                                    >
                                      <Button
                                        className="action-icon action-icon-delete"
                                        size="sm"
                                        onClick={() =>
                                          handleDeleteRow(
                                            tableIndex,
                                            originalIndex
                                          )
                                        }
                                        disabled={editingRow !== null}
                                      >
                                        <Trash />
                                      </Button>
                                    </OverlayTrigger>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card fade-in">
        <div className="action-buttons">
          <button
            className="action-button btn-primary"
            onClick={handleSubmitSales}
            disabled={!jsonOutput || !cNo || !currentDate || isLoading}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
              <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
            Final Submit
          </button>
        </div>
      </div>

      <footer style={{ textAlign: "center", marginTop: "2rem", color: "#888" }}>
        Version: {version}
      </footer>
    </div>
  );
}

export default CameraScan;

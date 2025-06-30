import React, { useState, useEffect, useRef } from "react";
import "./App.css";
import { Button, OverlayTrigger, Tooltip } from "react-bootstrap";
import { PencilSquare, Trash, Save, Eye } from "react-bootstrap-icons";
import imageCompression from "browser-image-compression";

function FinalApp() {
  const [image, setImage] = useState(null);
  const [tablesData, setTablesData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [jsonOutput, setJsonOutput] = useState(null);
  const [toast, setToast] = useState({ show: false, message: "", type: "" });
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
  const toastTimeoutRef = useRef();

  const ClosingStockvalue = 0;
  const total_sales = 0;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cNoParam = params.get("c_no");
    const typeParamValue = params.get("type");
    const numberCounterValue = params.get("number_counter");
    setTypeParam(typeParamValue);
    setNumberCounter(numberCounterValue);
    setType(typeParamValue || "Godown");
    if (cNoParam) {
      setCNo(cNoParam);
    } else {
      setError("No c_no provided in URL");
      showToast("No c_no provided in URL", "error");
    }
  }, []);

  const showToast = (message, type = "info") => {
    setToast({ show: true, message, type });
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => {
      setToast({ show: false, message: "", type: "" });
      toastTimeoutRef.current = null;
    }, 3000);
  };

  const closeToast = () => {
    setToast({ show: false, message: "", type: "" });
  };

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const fetchShopDetails = async () => {
      if (!cNo) return;
      try {
        const url = `https://deepikagroups.in/admin/api/getShopsList.php?type=${type}&c_no=${cNo}`;
        const data = await fetchWithRetry(url);
        const shopDetails = data.shop_details ? data.shop_details : [];
        const shop = shopDetails.find(
          (shop) => String(shop.id) === String(cNo)
        );
        if (shop) {
          setShopName(decodeURIComponent(shop.name || "Unnamed Shop"));
          console.log("Fetched shop name:", shop.name);
        } else {
          showToast(`No shop found for c_no: ${cNo}`, "error");
          setShopName("Unnamed Shop");
        }
      } catch (err) {
        console.error("Error fetching shop details:", err);
        showToast(`Failed to fetch shop details: ${err.message}`, "error");
        setShopName("Unnamed Shop");
      }
    };
    fetchShopDetails();
  }, [cNo, type]);

  const fetchWithRetry = async (
    url,
    options = {},
    retries = 3,
    delay = 1000
  ) => {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, {
          ...options,
        });
        if (!response.ok)
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        return await response.json();
      } catch (err) {
        if (i < retries - 1) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw err;
      }
    }
  };

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
      const url = `https://deepikagroups.in/admin/api/getProductStockDetails.php?type=${type}&c_no=${cNo}&date=${currentDate}&product_name=${encodedProductName}`;
      console.log("Fetching stock details with URL:", url);
      const data = await fetchWithRetry(url);
      console.log(
        "Raw API response for",
        productName,
        ":",
        JSON.stringify(data, null, 2)
      );

      if (data.Success === 1 && data.Messages === "Product does not exist") {
        return { tableIndex, rowIndex, error: "Product does not exist" };
      }

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
    } catch (err) {
      console.error(`Error fetching stock details for ${productName}:`, err);
      showToast(
        `Failed to fetch stock details for ${productName}: ${err.message}`,
        "error"
      );
      return { tableIndex, rowIndex, error: err.message };
    }
  };

  const handleFileChange = async (event) => {
    if (!cNo) {
      showToast("No c_no provided in URL", "error");
      return;
    }
    const file = event.target.files[0];
    if (!file) return;
    console.log("File selected:", {
      name: file.name,
      size: file.size,
      type: file.type,
      userAgent: navigator.userAgent,
    });
    processImage(file);
  };

  const processImage = async (file) => {
    setIsLoading(true);
    setError(null);
    setTablesData([]);
    setJsonOutput(null);
    setStockDetails({});
    setStockResultsState([]);
    setProgress(0);

    try {
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      };
      const compressedFile = await imageCompression(file, options);
      const imageUrl = URL.createObjectURL(compressedFile);
      setImage(imageUrl);
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          const next = prev + (100 - prev) * 0.1;
          return next > 95 ? 95 : next;
        });
      }, 200);
      await analyzeImageWithAI(compressedFile);
      clearInterval(progressInterval);
      setProgress(100);
    } catch (err) {
      console.error("Image processing error:", err);
      showToast("Failed to process image", "error");
    } finally {
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

      const response = await fetchWithRetry(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
      });

      const data = await response;
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
        if (firstBracket === -1 || lastBracket === -1) {
          throw new Error("No valid JSON array found in response");
        }
        cleanedText = cleanedText.substring(firstBracket, lastBracket + 1);
        if (cleanedText === "[]") {
          showToast("No tables detected in the image", "warning");
          setTablesData([[["No tables extracted"]]]);
          return;
        }
        parsedTables = JSON.parse(cleanedText);
        if (!Array.isArray(parsedTables)) {
          throw new Error("Response is not an array of tables");
        }

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
                    /rate|out sale|amount|o\.b|ksbcl receipt|cou\. trsfer|cou\ntrsfer|total|c.b.|sale/
                  ) &&
                (cell === "-" ||
                  cell === "" ||
                  cell === null ||
                  cell === undefined ||
                  cell === "—")
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
                    /rate|out sale|amount|o\.b|ksbcl receipt|cou\. trsfer|cou\ntrsfer/
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
                  cell === undefined
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
              productNameRaw.match(/\(\d+\)$/);

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
                  } else if (
                    Math.abs(obValue - stockData.data.OpeningStock) > 0.1
                  ) {
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
                } else if (
                  Math.abs(ksbclValue - stockData.data.Purchase) > 0.1
                ) {
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
                const counterTransferValue = Number(row[counterTransferIndex]);
                if (isNaN(counterTransferValue)) {
                  validations.push(
                    `Invalid Counter Transfer: "${row[counterTransferIndex]}" is not a valid number`
                  );
                } else if (
                  Math.abs(
                    counterTransferValue - stockData.data.Counter_Transfer
                  ) > 0.1
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
                    calculatedAmount =
                      (outSaleValue / closeBalance) * rateValue;
                  } else {
                    validations.push(
                      "Invalid Closing Stock: Cannot divide by zero"
                    );
                  }
                  console.log("Validation Debug:", {
                    tableIndex,
                    rowIndex,
                    product: row[productIndex],
                    rateValue,
                    outSaleValue,
                    closeBalance,
                    calculatedAmount,
                    actualAmount,
                  });
                  if (Math.abs(actualAmount - calculatedAmount) > 0.1) {
                    validations.push(
                      `Amount Mismatch: Expected ${calculatedAmount.toFixed(
                        2
                      )}, but got ${actualAmount}`
                    );
                  }
                }
              } else if (amountIndex !== -1) {
                const actualAmount = Number(row[amountIndex]);
                if (isNaN(actualAmount)) {
                  validations.push(
                    `Invalid Amount: "${row[amountIndex]}" is not a valid number`
                  );
                }
              }

              if (stockData?.error) {
                validations.push(`Stock Data Error: ${stockData.error}`);
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
              } else if (Math.abs(totalAmount - tableTotal) > 0.1) {
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
          showToast("No tables detected in the image", "warning");
        } else {
          showToast("Table extraction and validation completed!", "success");
        }
        setTablesData(updatedTables);

        const finalJSON = convertTableToJSON(updatedTables, stockResults, true);
        setJsonOutput(JSON.stringify(finalJSON, null, 2));
      } catch (parseError) {
        console.error("Error parsing JSON response:", parseError);
        setError(`Failed to parse JSON response: ${parseError.message}`);
        setTablesData([]);
        showToast("Error processing image", "error");
      }
    } catch (error) {
      console.error("Error analyzing image:", error);
      setError(`Failed to analyze the image: ${error.message}`);
      showToast("Error processing image", "error");
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
    showToast("JSON file downloaded", "success");
  };

  const handleSaveJSON = async () => {
    if (!jsonOutput) {
      showToast("No JSON data to save", "error");
      return;
    }
    try {
      const response = await fetchWithRetry(
        "https://jsonplaceholder.typicode.com/posts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: jsonOutput,
        }
      );
      showToast("JSON saved successfully!", "success");
    } catch (error) {
      console.error("Error saving JSON:", error);
      showToast(`Failed to save JSON: ${error.message}`, "error");
    }
  };

  const handleSubmitSales = async () => {
    if (!jsonOutput || !cNo || !currentDate) {
      showToast("Missing required fields (c_no, Date, or JSON)", "error");
      return;
    }

    try {
      const parsedJson = JSON.parse(jsonOutput);
      if (!parsedJson.tables || !Array.isArray(parsedJson.tables)) {
        showToast("Invalid JSON structure", "error");
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
            qty > 0
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

          if (!isNaN(counterTransfer) && counterTransfer > 0) {
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
        showToast(
          "No valid rows to submit. Ensure rows have valid product names, Rate, and Out Sale or Counter Transfer values.",
          "warning"
        );
        return;
      }

      setIsLoading(true);
      const results = await Promise.all(salePromises);
      setIsLoading(false);

      const successes = results.filter((r) => r.success);
      const failures = results.filter((r) => !r.success);

      if (successes.length > 0) {
        const saleSuccesses = successes.filter((r) => r.type === "sale").length;
        const transferSuccesses = successes.filter(
          (r) => r.type === "transfer"
        ).length;
        showToast(
          `Successfully submitted ${saleSuccesses} sale(s) and ${transferSuccesses} counter transfer(s)`,
          "success"
        );
      }
      if (failures.length > 0) {
        failures.forEach((f) => {
          showToast(
            `Failed to submit ${f.type} for ${f.productName}: ${f.error}`,
            "error"
          );
        });
      }
    } catch (error) {
      console.error("Error submitting sales or transfers:", error);
      showToast(`Failed to submit data: ${error.message}`, "error");
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
    setEditingRow({ tableIndex, rowIndex });
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
            /rate|out sale|amount|o\.b|ksbcl receipt|cou\. trsfer|cou\ntrsfer/
          ) &&
          (value === "" || value === "-")
        ) {
          return 0;
        }
        if (
          header.match(
            /rate|out sale|amount|o\.b|ksbcl receipt|cou\. trsfer|cou\ntrsfer/
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
        typeof productName === "string" && productName.match(/\(\d+\)$/);
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
        const obIndex = headers.findIndex((h) => h.toLowerCase().match(/o\.b/));
        const ksbclIndex = headers.findIndex((h) =>
          h.toLowerCase().match(/ksbcl\s*receipt/)
        );
        const counterTransferIndex = headers.findIndex((h) =>
          h
            .toLowerCase()
            .match(/cou\.?\s*trsfer|cou\s*ntrsfer|counter\s*transfer/)
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
            } else if (
              Math.abs(obValue - stockResult.data.OpeningStock) > 0.1
            ) {
              validations.push(
                `OB Mismatch: ${obValue} does not match expected ${stockResult.data.OpeningStock}`
              );
            }
          }

          if (ksbclIndex !== -1) {
            const ksbclValue = Number(sanitizedEditValues[ksbclIndex]);
            if (isNaN(ksbclValue)) {
              validations.push(
                `Invalid KSBCL Receipt: "${sanitizedEditValues[ksbclIndex]}" is not a valid number`
              );
            } else if (Math.abs(ksbclValue - stockResult.data.Purchase) > 0.1) {
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
              Math.abs(
                counterTransferValue - stockResult.data.Counter_Transfer
              ) > 0.1
            ) {
              validations.push(
                `Counter Transfer Mismatch: ${counterTransferValue} does not match expected ${stockResult.data.Counter_Transfer}`
              );
            }
          }
        }

        if (rateIndex !== -1) {
          const rateValue = Number(sanitizedEditValues[rateIndex]);
          if (isNaN(rateValue)) {
            validations.push(
              `Invalid Rate: "${sanitizedEditValues[rateIndex]}" is not a valid number`
            );
          } else if (rateValue < 0) {
            validations.push(`Invalid Rate: ${rateValue} cannot be negative`);
          }
        }

        if (outSaleIndex !== -1) {
          const outSaleValue = Number(sanitizedEditValues[outSaleIndex]);
          if (isNaN(outSaleValue)) {
            validations.push(
              `Invalid Out Sale: "${sanitizedEditValues[outSaleIndex]}" is not a valid number`
            );
          } else if (outSaleValue < 0) {
            validations.push(
              `Invalid Out Sale: ${outSaleValue} cannot be negative`
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
              validations.push("Invalid Closing Stock: Cannot divide by zero");
            }
            if (Math.abs(actualAmount - calculatedAmount) > 0.1) {
              validations.push(
                `Amount Mismatch: Expected ${calculatedAmount.toFixed(
                  2
                )}, but got ${actualAmount}`
              );
            }
          }
        } else if (amountIndex !== -1) {
          const actualAmount = Number(sanitizedEditValues[amountIndex]);
          if (isNaN(actualAmount)) {
            validations.push(
              `Invalid Amount: "${sanitizedEditValues[amountIndex]}" is not a valid number`
            );
          }
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

      updatedTables[tableIndex][rowIndex + 1] = [
        ...sanitizedEditValues,
        validationValue,
      ];

      const amountIndex = headers.findIndex(
        (h) => h.toLowerCase() === "amount"
      );
      let tableTotal = 0;
      const updatedAmounts = amounts.filter(
        (a) => !(a.tableIndex === tableIndex && a.rowIndex === rowIndex + 1)
      );
      if (amountIndex !== -1) {
        const amount = Number(sanitizedEditValues[amountIndex]);
        if (!isNaN(amount) && amount >= 0) {
          updatedAmounts.push({ tableIndex, rowIndex: rowIndex + 1, amount });
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
          : Math.abs(totalAmount - tableTotal) > 0.1
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

      showToast("Row updated successfully!", "success");
    } catch (error) {
      console.error("Error in handleSaveEdit:", error);
      showToast(`Failed to save edit: ${error.message}`, "error");
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
          : Math.abs(totalAmount - tableTotal) > 0.1
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
    showToast("Row deleted successfully!", "success");
  };

  const toggleTooltip = (tableIndex, rowIndex) => {
    const key = `${tableIndex}-${rowIndex}`;
    setVisibleTooltip(visibleTooltip === key ? null : key);
  };

  const syntaxHighlight = (json) => {
    if (!json) return "";
    json = json
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
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

  const cleanProductName = (name) =>
    typeof name === "string" ? name.replace(/\s*\(\d+\)\s*$/, "").trim() : name;

  return (
    <div className="App">
      {toast.show && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === "success" && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="toast-icon"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          )}
          {toast.type === "error" && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="toast-icon"
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
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
          )}
          {toast.type === "info" && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="toast-icon"
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
          )}
          {toast.type === "warning" && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="toast-icon"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          )}
          <span className="toast-message">{toast.message}</span>
          <button className="toast-close" onClick={closeToast}>
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
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      )}

      <nav className="navbar">
        <div className="navbar-container">
          <div className="navbar-items flex-row-mobile">
            {typeParam === "Godown" && numberCounter === "2" && (
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
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
                Upload Image
              </label>
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

      {image && (
        <div className="card fade-in">
          <h2 className="section-title">Image Preview</h2>
          <div className="image-preview-container">
            <img src={image} alt="Uploaded" className="image-preview" />
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
    </div>
  );
}

export default FinalApp;

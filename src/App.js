import React, { useState, useEffect } from "react";
import "./App.css";

function Stock() {
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
  const [type, setType] = useState(null); // Godown/Counter
  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState("");
  const [currentDate, setCurrentDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [stockDetails, setStockDetails] = useState({});
  const [stockResultsState, setStockResultsState] = useState([]);

  const showToast = (message, type = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "" }), 3000);
  };

  const closeToast = () => {
    setToast({ show: false, message: "", type: "" });
  };

  useEffect(() => {
    const fetchShops = async () => {
      if (!type) return;
      try {
        const url = `https://deepikagroups.in/admin/api/getShopsList.php?type=${type}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch shops list");
        const data = await response.json();
        const shopDetails = data.shop_details ? data.shop_details : [];
        const normalizedShops = shopDetails.map((shop) => ({
          ...shop,
          id: String(shop.id),
        }));
        setShops(normalizedShops);
        setSelectedShop(
          normalizedShops.length > 0 ? normalizedShops[0].id : ""
        );
        console.log("Fetched shops:", normalizedShops);
      } catch (err) {
        console.error("Error fetching shops:", err);
        showToast(`Failed to fetch shops: ${err.message}`, "error");
        setShops([]);
        setSelectedShop("");
      }
    };
    fetchShops();
  }, [type]);

  useEffect(() => {
    console.log("Updated shops:", shops);
    console.log("Current selectedShop:", selectedShop);
  }, [shops, selectedShop]);

  const fetchProductStockDetails = async (
    productName,
    tableIndex,
    rowIndex
  ) => {
    if (!type || !selectedShop || !currentDate) {
      console.log("Missing required fields for stock details:", {
        type,
        selectedShop,
        currentDate,
      });
      return { tableIndex, rowIndex, error: "Missing type, shop, or date" };
    }
    try {
      const selectedShopObj = shops.find(
        (shop) => shop.id === String(selectedShop)
      );
      if (!selectedShopObj) {
        console.log("Selected shop not found:", selectedShop, shops);
        return { tableIndex, rowIndex, error: "Selected shop not found" };
      }
      const companyId = selectedShopObj.id;
      const encodedProductName = encodeURIComponent(productName);
      const url = `https://deepikagroups.in/admin/api/getProductStockDetails.php?type=${type}&c_no=${companyId}&date=${currentDate}&product_name=${encodedProductName}`;
      console.log("Fetching stock details with URL:", url);
      const response = await fetch(url);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `HTTP ${response.status}: Failed to fetch stock details for ${productName}`
        );
      }
      const data = await response.json();
      return {
        tableIndex,
        rowIndex,
        data: {
          OpeningStock: Number(data.OpeningStock ?? 0),
          Purchase: Number(data.Purchase ?? 0),
          Sales: Number(data.sales ?? 0),
          Counter_Transfer: Number(data.Counter_Transfer ?? 0),
          CounterReceived: Number(data.CounterReceived ?? 0),
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

  const handleFileChange = async (e) => {
    if (!type || !selectedShop) {
      showToast(
        "Please select Type and Shop before uploading an image",
        "error"
      );
      return;
    }
    const file = e.target.files[0];
    if (!file) return;
    processImage(file);
  };

  const handleOpenCamera = async () => {
    if (!type || !selectedShop) {
      showToast("Please select Type and Shop before taking a photo", "error");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      const video = document.createElement("video");
      video.srcObject = stream;
      video.autoplay = true;
      await new Promise((resolve) => {
        video.onloadedmetadata = () => resolve();
      });
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      stream.getTracks().forEach((track) => track.stop());
      canvas.toBlob((blob) => {
        if (!blob) {
          showToast("Failed to capture image", "error");
          return;
        }
        const imageUrl = URL.createObjectURL(blob);
        setImage(imageUrl);
        processImage(
          new File([blob], "camera-capture.jpg", { type: "image/jpeg" })
        );
      }, "image/jpeg");
    } catch (err) {
      console.error("Error accessing camera:", err);
      showToast(`Failed to access camera: ${err.message}`, "error");
    }
  };

  const processImage = async (file) => {
    setIsLoading(true);
    setError(null);
    setTablesData([]);
    setJsonOutput(null);
    setStockDetails({});
    setStockResultsState([]);
    setProgress(0);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + (100 - prev) * 0.1;
        return next > 95 ? 95 : next;
      });
    }, 200);

    const imageUrl = URL.createObjectURL(file);
    setImage(imageUrl);

    await analyzeImageWithAI(file);
    clearInterval(progressInterval);
    setProgress(100);
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
                text: "Extract all tables from the image, including the header row for each table. Return the result as a valid JSON array of tables, where each table is an array of arrays, and each inner array represents a row of cell values (with the first array being the header row). If multiple tables are detected, include each table as a separate array in the output. If any total value is present, include it as the last row of the respective table. If no tables are detected, return an empty array. Ensure the output is strictly valid JSON, with no markdown, code blocks, trailing commas, trailing whitespace, newlines, or any text outside the JSON structure. Close all arrays properly.",
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
                  .match(/rate|out sale|amount|o\.b|ksbcl receipt/) &&
                (cell === "" || cell == null)
              ) {
                return 0;
              }
              if (i > 0 && !isNaN(cell) && cell !== "") return Number(cell);
              return cell;
            });
          });
          return sanitizedTable;
        });

        const tableJSON = convertTableToJSON(parsedTables);
        const stockPromises = [];
        tableJSON.tables.forEach((table, tableIndex) => {
          table.forEach((row, rowIndex) => {
            const productName =
              row["Name of Brands"] ||
              row["name of brands"] ||
              row.Product ||
              row.product ||
              row.Item ||
              row.item;
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
                h.toLowerCase() === "о.в." ||
                h.toLowerCase() === "o.b.")
          );
          const kMBOLIndex = headers.findIndex(
            (h) =>
              typeof h === "string" &&
              (h.toLowerCase() === "ksbcl\nreceipt" ||
                h.toLowerCase() === "receipt" ||
                h.toLowerCase() === "ksbcl receipt" ||
                h.toLowerCase() === "ksbcl .receipt" ||
                h.toLowerCase() === "ksbol receipt" ||
                h.toLowerCase() === "ksbol .receipt" ||
                h.toLowerCase() === "ksbol\nreceipt")
          );
          const productIndex = headers.findIndex(
            (h) =>
              typeof h === "string" &&
              (h.toLowerCase() === "name of brands" ||
                h.toLowerCase() === "product" ||
                h.toLowerCase() === "item")
          );
          const dataRows = table.slice(1);
          let tableTotal = 0;

          const updatedRows = dataRows.map((row, rowIndex) => {
            const isTotalRow =
              row[0].toLowerCase().includes("total") ||
              row[0].toLowerCase().includes("grand total");
            const validations = [];
            const stockData = stockResults.find(
              (r) => r.tableIndex === tableIndex && r.rowIndex === rowIndex
            );

            if (!isTotalRow) {
              if (
                productIndex !== -1 &&
                (!row[productIndex] || row[productIndex] === "")
              ) {
                validations.push("Product: missing or empty");
              }

              if (
                obIndex !== -1 &&
                stockData?.data?.OpeningStock !== undefined
              ) {
                const obValue = Number(row[obIndex]);
                if (isNaN(obValue)) {
                  validations.push(`O.B: not a number (${row[obIndex]})`);
                } else if (obValue !== stockData.data.OpeningStock) {
                  validations.push(
                    `O.B: ${obValue} ≠ ${stockData.data.OpeningStock}`
                  );
                }
              } else if (obIndex !== -1 && !stockData?.data) {
                validations.push("O.B: no stock data");
              }

              if (
                kMBOLIndex !== -1 &&
                stockData?.data?.Purchase !== undefined
              ) {
                const kMBOLValue = Number(row[kMBOLIndex]);
                if (isNaN(kMBOLValue)) {
                  validations.push(`KSBCL: not a number (${row[kMBOLIndex]})`);
                } else if (kMBOLValue !== stockData.data.Purchase) {
                  validations.push(
                    `KSBCL: ${kMBOLValue} ≠ ${stockData.data.Purchase}`
                  );
                }
              } else if (kMBOLIndex !== -1 && !stockData?.data) {
                validations.push("KSBCL: no stock data");
              }

              if (rateIndex !== -1) {
                const rateValue = Number(row[rateIndex]);
                if (isNaN(rateValue)) {
                  validations.push(`Rate: not a number (${row[rateIndex]})`);
                } else if (rateValue < 0) {
                  validations.push(`Rate: negative (${rateValue})`);
                }
              }

              if (outSaleIndex !== -1) {
                const outSaleValue = Number(row[outSaleIndex]);
                if (isNaN(outSaleValue)) {
                  validations.push(
                    `Out Sale: not a number (${row[outSaleIndex]})`
                  );
                } else if (outSaleValue < 0) {
                  validations.push(`Out Sale: negative (${outSaleValue})`);
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
                    `Amount: not a number (${row[amountIndex]})`
                  );
                } else if (!isNaN(rateValue) && !isNaN(outSaleValue)) {
                  const calculatedAmount = rateValue * outSaleValue;
                  if (Math.abs(actualAmount - calculatedAmount) > 0.01) {
                    validations.push(
                      `Amount: ${calculatedAmount} ≠ ${actualAmount}`
                    );
                  }
                }
              } else if (amountIndex !== -1) {
                const actualAmount = Number(row[amountIndex]);
                if (isNaN(actualAmount)) {
                  validations.push(
                    `Amount: not a number (${row[amountIndex]})`
                  );
                }
              }

              if (stockData?.error) {
                validations.push(`Stock: ${stockData.error}`);
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
                  validations.push("Amount: invalid for total");
                }
              }
            }

            if (isTotalRow && amountIndex !== -1) {
              const totalAmount = Number(row[amountIndex]);
              if (isNaN(totalAmount)) {
                validations.push(`Total: not a number (${row[amountIndex]})`);
              } else if (Math.abs(totalAmount - tableTotal) > 0.01) {
                validations.push(`Total: ${totalAmount} ≠ ${tableTotal}`);
              } else {
                validations.push("Total: Correct");
              }
            }

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
    showToast("JSON file downloaded", "success");
  };

  const handleSaveJSON = async () => {
    if (!jsonOutput) {
      showToast("No JSON data to save", "error");
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
      showToast("JSON saved successfully!", "success");
    } catch (error) {
      console.error("Error saving JSON:", error);
      showToast(`Failed to save JSON: ${error.message}`, "error");
    }
  };

  const handleSubmitSales = async () => {
    if (!jsonOutput || !type || !selectedShop || !currentDate) {
      showToast("Missing required fields (Type, Shop, Date, or JSON)", "error");
      return;
    }

    try {
      const parsedJson = JSON.parse(jsonOutput);
      if (!parsedJson.tables || !Array.isArray(parsedJson.tables)) {
        showToast("Invalid JSON structure", "error");
        return;
      }

      const selectedShopObj = shops.find(
        (shop) => shop.id === String(selectedShop)
      );
      if (!selectedShopObj) {
        console.log("Selected shop not found in submit:", selectedShop, shops);
        showToast("Selected shop not found", "error");
        return;
      }

      const c_no = selectedShopObj.id;
      const c_name = decodeURIComponent(selectedShopObj.name || "Unnamed Shop");

      const salePromises = [];
      parsedJson.tables.forEach((table, tableIndex) => {
        const headers = tablesData[tableIndex][0];
        const counterTransferIndex = headers.findIndex(
          (h) =>
            typeof h === "string" &&
            (h.toLowerCase() === "cou. trsfer" ||
              h.toLowerCase() === "cou\ntrsfer")
        );

        table.forEach((row, rowIndex) => {
          const productName =
            row["Name of Brands"] ||
            row["name of brands"] ||
            row.Product ||
            row.product ||
            row.Item ||
            row.item;
          const rate = Number(row.Rate || row.rate || 0);
          const qty = Number(row["Out\nSale"] || row["out sale"] || 0);
          const counterTransfer =
            counterTransferIndex !== -1
              ? Number(
                  tablesData[tableIndex][rowIndex + 1][counterTransferIndex]
                ) || 0
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
              !isNaN(qty),
          });

          if (
            productName &&
            !productName.toLowerCase().includes("total") &&
            !isNaN(rate) &&
            rate > 0 &&
            !isNaN(qty) &&
            qty > 0
          ) {
            const saleParams = new URLSearchParams({
              c_no,
              c_name: encodeURIComponent(c_name),
              p_name: encodeURIComponent(productName),
              date: currentDate,
              price: rate.toFixed(2),
              type,
              qty: Number(qty),
            });
            console.log("value of counter transfor:", counterTransfer);
            const salesParams = decodeURIComponent(saleParams).replace(
              /%20/g,
              " "
            );
            console.log("sales Params:", salesParams);
            const saleUrl = `https://deepikagroups.in/admin/api/add_AI_sale.php?${salesParams}`;
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

            if (counterTransfer > 0) {
              const rateValue = Number(rate);
              const transferQty = Number(counterTransfer);
              if (
                isNaN(rateValue) &&
                rateValue < 0 &&
                isNaN(transferQty) &&
                transferQty <= 0
              ) {
                showToast(
                  `Invalid rate (${rate}) or counter transfer quantity (${counterTransfer}) for ${productName}`,
                  "error"
                );
                return;
              }

              const transferParams = new URLSearchParams({
                c_no,
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

  const canEditRow = (tableIndex, rowIndex) => {
    const stockKey = `${tableIndex}-${rowIndex}`;
    const stockData = stockDetails[stockKey] || {};
    let canEdit = false;

    if (type === "Counter") {
      canEdit =
        (stockData.CounterReceived === 0 ||
          stockData.CounterReceived === null) &&
        (stockData.Sales === 0 || stockData.Sales === null);
    } else if (type === "Godown") {
      canEdit =
        (stockData.Counter_Transfer === 0 ||
          stockData.Counter_Transfer === null) &&
        (stockData.Sales === 0 || stockData.Sales === null);
    }

    return canEdit;
  };

  const handleEditRow = (tableIndex, rowIndex) => {
    if (!canEditRow(tableIndex, rowIndex)) {
      showToast("Cannot edit: Sales or transfers exist", "error");
      return;
    }
    const rowData = tablesData[tableIndex][rowIndex + 1];
    setEditingRow({ tableIndex, rowIndex });
    setEditValues(rowData.slice(0, rowData.length - 1));
  };

  const handleSaveEdit = async (tableIndex, rowIndex) => {
    const updatedTables = [...tablesData];
    const headers = updatedTables[tableIndex][0];
    const oldRow = updatedTables[tableIndex][rowIndex + 1];
    const validationTypes = ["Validation"];
    updatedTables[tableIndex][rowIndex + 1] = [
      ...editValues,
      ...Array(validationTypes.length).fill(""),
    ];

    const rateIndex = headers.findIndex(
      (h) => typeof h === "string" && h.toLowerCase() === "rate"
    );
    const outSaleIndex = headers.findIndex(
      (h) => typeof h === "string" && h.toLowerCase() === "out sale"
    );
    const amountIndex = headers.findIndex(
      (h) => typeof h === "string" && h.toLowerCase() === "amount"
    );
    const obIndex = headers.findIndex(
      (h) =>
        typeof h === "string" &&
        (h.toLowerCase() === "o.b" || h.toLowerCase() === "о.в.")
    );
    const kMBOLIndex = headers.findIndex(
      (h) =>
        typeof h === "string" &&
        (h.toLowerCase() === "ksbol receipt" ||
          h.toLowerCase() === "ksbcl receipt")
    );
    const productIndex = headers.findIndex(
      (h) =>
        typeof h === "string" &&
        (h.toLowerCase() === "name of brands" ||
          h.toLowerCase() === "product" ||
          h.toLowerCase() === "item")
    );
    const stockKey = `${tableIndex}-${rowIndex}`;
    const stockData = stockDetails[stockKey] || {};

    const validations = [];

    if (
      productIndex !== -1 &&
      (!editValues[productIndex] || editValues[productIndex] === "")
    ) {
      validations.push("Product: missing or empty");
    }

    if (obIndex !== -1 && stockData?.OpeningStock !== undefined) {
      const obValue = Number(editValues[obIndex]);
      if (isNaN(obValue)) {
        validations.push(`O.B: not a number (${editValues[obIndex]})`);
      } else if (obValue !== stockData.OpeningStock) {
        validations.push(
          `O.B Mismatch :${obValue} ≠ ${stockData.OpeningStock}`
        );
      }
    } else if (obIndex !== -1 && !stockData) {
      validations.push("O.B: no stock data");
    }

    if (kMBOLIndex !== -1 && stockData?.Purchase !== undefined) {
      const kMBOLValue = Number(editValues[kMBOLIndex]);
      if (isNaN(kMBOLValue)) {
        validations.push(`KSBCL: not a number (${editValues[kMBOLIndex]})`);
      } else if (kMBOLValue !== stockData.Purchase) {
        validations.push(
          `KSBCL Mismatch : ${kMBOLValue} ≠ ${stockData.Purchase}`
        );
      }
    } else if (kMBOLIndex !== -1 && !stockData) {
      validations.push("KSBCL: no stock data");
    }

    if (rateIndex !== -1) {
      const rateValue = Number(editValues[rateIndex]);
      if (isNaN(rateValue)) {
        validations.push(`Rate: not a number (${editValues[rateIndex]})`);
      } else if (rateValue < 0) {
        validations.push(`Rate: negative (${rateValue})`);
      }
    }

    if (outSaleIndex !== -1) {
      const outSaleValue = Number(editValues[outSaleIndex]);
      if (isNaN(outSaleValue)) {
        validations.push(
          `Out Sale: not a number (${editValues[outSaleIndex]})`
        );
      } else if (outSaleValue < 0) {
        validations.push(`Out Sale: negative (${outSaleValue})`);
      }
    }

    if (rateIndex !== -1 && outSaleIndex !== -1 && amountIndex !== -1) {
      const rateValue = Number(editValues[rateIndex]);
      const outSaleValue = Number(editValues[outSaleIndex]);
      const actualAmount = Number(editValues[amountIndex]);
      if (isNaN(actualAmount)) {
        validations.push(`Amount: not a number (${editValues[amountIndex]})`);
      } else if (!isNaN(rateValue) && !isNaN(outSaleValue)) {
        const calculatedAmount = rateValue * outSaleValue;
        if (Math.abs(actualAmount - calculatedAmount) > 0.01) {
          validations.push(
            `Amount Mismatch : ${calculatedAmount} ≠ ${actualAmount}`
          );
        }
      }
    } else if (amountIndex !== -1) {
      const actualAmount = Number(editValues[amountIndex]);
      if (isNaN(actualAmount)) {
        validations.push(`Amount: not a number (${editValues[amountIndex]})`);
      }
    }

    if (stockData?.error) {
      validations.push(`Stock: ${stockData.error}`);
    }

    updatedTables[tableIndex][rowIndex + 1] = [
      ...editValues,
      validations.join("; ") || "Correct",
    ];

    const changes = headers
      .slice(0, headers.length - validationTypes.length)
      .reduce((acc, header, i) => {
        if (oldRow[i] !== editValues[i])
          acc.push(`${header}: ${oldRow[i]} -> ${editValues[i]}`);
        return acc;
      }, []);

    const amountValues = [...amounts];
    const amountIdx = amountValues.findIndex(
      (a) => a.tableIndex === tableIndex && a.rowIndex === rowIndex + 1
    );
    if (
      amountIndex !== -1 &&
      !isNaN(Number(editValues[amountIndex])) &&
      Number(editValues[amountIndex]) >= 0
    ) {
      if (amountIdx !== -1) {
        amountValues[amountIdx].amount = Number(editValues[amountIndex]);
      } else {
        amountValues.push({
          tableIndex,
          rowIndex: rowIndex + 1,
          amount: Number(editValues[amountIndex]),
        });
      }
    }

    if (updatedTables[tableIndex].length > 1) {
      const lastRow =
        updatedTables[tableIndex][updatedTables[tableIndex].length - 1];
      if (
        lastRow[0].toLowerCase().includes("total") ||
        lastRow[0].toLowerCase().includes("grand total")
      ) {
        const tableTotal = amountValues
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
    setAmounts(amountValues);
    setEditingRow(null);
    setEditValues([]);
    const tableJSON = convertTableToJSON(
      updatedTables,
      stockResultsState,
      true
    );
    setJsonOutput(JSON.stringify(tableJSON, null, 2));
    showToast("Row updated successfully!", "success");
  };

  const handleDeleteRow = (tableIndex, rowIndex) => {
    const updatedTables = [...tablesData];
    const headers = updatedTables[tableIndex][0];
    const amountIndex = headers.findIndex(
      (h) => typeof h === "string" && h.toLowerCase() === "amount"
    );
    updatedTables[tableIndex].splice(rowIndex + 1, 1);

    const amountValues = amounts.filter(
      (a) => !(a.tableIndex === tableIndex && a.rowIndex === rowIndex + 1)
    );

    if (updatedTables[tableIndex].length > 1) {
      const lastRow =
        updatedTables[tableIndex][updatedTables[tableIndex].length - 1];
      if (
        lastRow[0].toLowerCase().includes("total") ||
        lastRow[0].toLowerCase().includes("grand total")
      ) {
        const tableTotal = amountValues
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
    setAmounts(amountValues);
    const tableJSON = convertTableToJSON(
      updatedTables,
      stockResultsState,
      true
    );
    setJsonOutput(JSON.stringify(tableJSON, null, 2));
    showToast("Row deleted successfully!", "success");
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

      <div className="app-brand">
        <svg
          className="app-brand-icon"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="9" y1="3" x2="9" y2="21"></line>
          <line x1="3" y1="9" x2="21" y2="9"></line>
          <line x1="3" y1="15" x2="9" y2="15"></line>
        </svg>
        <div>
          <h1 className="app-title">Deepika AI Software</h1>
          <div className="app-note" style={{ marginTop: "5px" }}>
            <p>
              This is an AI-generated task. For best results, use a clear image.
            </p>
            <p lang="kn">
              ಇದು AI-ಜನರೇಟೆಡ್ ಕಾರ್ಯವಾಗಿದೆ. ಉತ್ತಮ ಫಲಿತಾಂಶಕ್ಕಾಗಿ, ಸ್ಪಷ್ಟ
              ಚಿತ್ರವನ್ನು ಬಳಸಿ.
            </p>
          </div>
        </div>
      </div>

      <nav className="navbar">
        <div className="navbar-container">
          <div className="navbar-items">
            <div className="navbar-dropdown">
              <select
                value={type || ""}
                onChange={(e) => setType(e.target.value)}
                className="navbar-select"
              >
                <option value="" disabled>
                  Select Type
                </option>
                <option value="Counter">Counter</option>
                <option value="Godown">GoDown</option>
              </select>
            </div>
            <div className="navbar-dropdown">
              <select
                value={selectedShop}
                onChange={(e) => {
                  const newShopId = e.target.value;
                  setSelectedShop(newShopId);
                  console.log("Selected shop changed to:", newShopId);
                }}
                className="navbar-select"
                disabled={shops.length === 0}
              >
                <option value="" disabled>
                  Select a shop
                </option>
                {shops.length > 0 ? (
                  shops.map((shop, index) => (
                    <option key={shop.id || index} value={shop.id}>
                      {shop.name || "Unnamed Shop"}
                    </option>
                  ))
                ) : (
                  <option value="">No shops available</option>
                )}
              </select>
            </div>
            <div className="navbar-date">
              <input
                type="date"
                value={currentDate}
                onChange={(e) => setCurrentDate(e.target.value)}
                className="navbar-date-input"
              />
            </div>
          </div>
        </div>
      </nav>

      <div className="card fade-in">
        <div className="action-buttons">
          <button
            className="action-button btn-primary icon-button"
            onClick={handleOpenCamera}
            disabled={!type || !selectedShop}
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
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"></path>
              <circle cx="12" cy="13" r="4"></circle>
            </svg>
            Take Photo
          </button>
          <button
            className="action-button btn-outline icon-button"
            onClick={() => document.getElementById("fileInput").click()}
            disabled={!type || !selectedShop}
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
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            Upload Image
          </button>
          <input
            id="fileInput"
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
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
          <div className="table-container">
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
                      {table.slice(1).map((row, rowIndex) => (
                        <tr key={`row-${tableIndex}-${rowIndex}`}>
                          {row.map((cell, cellIndex) => (
                            <td
                              key={`cell-${tableIndex}-${rowIndex}-${cellIndex}`}
                            >
                              {editingRow &&
                              editingRow.tableIndex === tableIndex &&
                              editingRow.rowIndex === rowIndex &&
                              cellIndex < table[0].length - 1 ? (
                                <input
                                  type="text"
                                  value={editValues[cellIndex] || ""}
                                  onChange={(e) => {
                                    const newValues = [...editValues];
                                    newValues[cellIndex] = e.target.value;
                                    setEditValues(newValues);
                                  }}
                                />
                              ) : (
                                cell
                              )}
                            </td>
                          ))}
                          <td>
                            {editingRow &&
                            editingRow.tableIndex === tableIndex &&
                            editingRow.rowIndex === rowIndex ? (
                              <>
                                <button
                                  className="button btn-small"
                                  onClick={() =>
                                    handleSaveEdit(tableIndex, rowIndex)
                                  }
                                >
                                  Save
                                </button>
                                <button
                                  className="button btn-small"
                                  onClick={() => {
                                    setEditingRow(null);
                                    setEditValues([]);
                                  }}
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  className="button btn-small"
                                  onClick={() =>
                                    handleEditRow(tableIndex, rowIndex)
                                  }
                                  disabled={
                                    editingRow !== null ||
                                    !canEditRow(tableIndex, rowIndex)
                                  }
                                >
                                  Edit
                                </button>
                                <button
                                  className="button btn-small"
                                  onClick={() =>
                                    handleDeleteRow(tableIndex, rowIndex)
                                  }
                                  disabled={editingRow !== null}
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {jsonOutput && (
        <div className="card fade-in">
          <div className="card-header">
            <h2 className="section-title">JSON Data Output</h2>
            <div>
              <button
                className="action-button btn-small"
                onClick={handleDownloadJSON}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Download JSON
              </button>
              <button
                className="action-button btn-small"
                onClick={handleSaveJSON}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
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
                Save JSON
              </button>
            </div>
          </div>
          <div className="json-container">
            <pre
              className="json-preview"
              dangerouslySetInnerHTML={{ __html: syntaxHighlight(jsonOutput) }}
            />
          </div>
        </div>
      )}

      <div className="card fade-in">
        <div className="action-buttons">
          <button
            className="action-button btn-primary"
            onClick={handleSubmitSales}
            disabled={
              !jsonOutput || !type || !selectedShop || !currentDate || isLoading
            }
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

      <footer className="app-footer">
        <p>Deepika AI Software © {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}

export default Stock;

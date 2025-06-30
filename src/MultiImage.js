// Stock.jsx
import React, { useState, useEffect } from "react";
import "./Sample.css";
import { Button, OverlayTrigger, Tooltip } from "react-bootstrap";
import { PencilSquare, Trash, Save, Eye } from "react-bootstrap-icons";

function MultiImage() {
  const [images, setImages] = useState([]);
  const [tablesData, setTablesData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [jsonOutputs, setJsonOutputs] = useState([]);
  const [toast, setToast] = useState({ show: false, message: "", type: "" });
  const [progress, setProgress] = useState([]);
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
    setTimeout(() => setToast({ show: false, message: "", type: "" }), 3000);
  };

  const closeToast = () => {
    setToast({ show: false, message: "", type: "" });
  };

  useEffect(() => {
    const fetchShopDetails = async () => {
      if (!cNo) return;
      try {
        const url = `https://deepikagroups.in/admin/api/getShopsList.php?type=${type}&c_no=${cNo}`;
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

  const fetchProductStockDetails = async (
    productName,
    tableIndex,
    rowIndex,
    imageIndex
  ) => {
    if (!cNo || !currentDate) {
      console.log("Missing required fields for stock details:", {
        cNo,
        currentDate,
      });
      return {
        imageIndex,
        tableIndex,
        rowIndex,
        error: "Missing c_no or date",
      };
    }
    try {
      const newproductname = cleanProductName(productName);
      const encodedProductName = encodeURIComponent(newproductname);
      // console.log("cleaned product name:", newproductname);
      // console.log("encoded product name:", encodedProductName);
      const url = `https://deepikagroups.in/admin/api/getProductStockDetails.php?type=${type}&c_no=${cNo}&date=${currentDate}&product_name=${encodedProductName}`;
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
      return {
        imageIndex,
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
      showToast(`Failed to fetch stock details`);
      return { imageIndex, tableIndex, rowIndex, error: err.message };
    }
  };

  const handleFileChange = async (event) => {
    if (!cNo) {
      showToast("No c_no provided in URL", "error");
      return;
    }
    const files = Array.from(event.target.files);
    if (!files.length) return;

    // Append new images instead of replacing
    const newImages = files.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));
    setImages((prev) => {
      const updatedImages = [...prev, ...newImages];
      files.forEach((file, index) => {
        processImage(file, prev.length + index); // Use prev.length instead of prevImages.length
      });
      return updatedImages;
    });
    setProgress((prev) => [...prev, ...files.map(() => 0)]);
    setTablesData((prev) => [...prev, ...files.map(() => [])]);
    setJsonOutputs((prev) => [...prev, ...files.map(() => "")]);
  };

  const processImage = async (file, imageIndex) => {
    setIsLoading(true);
    setError(null);

    const updateProgress = (value) => {
      setProgress((prev) => {
        const newprogress = [...prev];
        newprogress[imageIndex] = value;
        return newprogress;
      });
    };

    // Initialize progress for this image to 0
    setProgress((prev) => {
      const newprogress = [...prev];
      newprogress[imageIndex] = 0;
      return newprogress;
    });

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        const newprogress = [...prev];
        const current = newprogress[imageIndex] || 0;
        const next = current + (100 - current) * 0.1;
        newprogress[imageIndex] = next > 95 ? 95 : next;
        return newprogress;
      });
    }, 200);

    await analyzeImageWithAI(file, imageIndex);
    clearInterval(progressInterval);

    // Set progress for this image to 100
    setProgress((prev) => {
      const newprogress = [...prev];
      newprogress[imageIndex] = 100;
      return newprogress;
    });

    setIsLoading(false);
  };

  const analyzeImageWithAI = async (file, imageIndex) => {
    try {
      // Convert file to base64 data URL
      const toBase64Url = (file) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result);
          reader.onerror = (error) => reject(error);
        });

      const base64Url = await toBase64Url(file);

      // Call OpenRouter API
      const apiKey =
        "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";
      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,

            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-pro-exp-03-25",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "What is in this image?",
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: base64Url, // Use base64 data URL
                    },
                  },
                ],
              },
            ],
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.statusText}`);
      }

      const data = await response.json();
      // You may need to adjust this depending on the API's response structure
      const resultText = data.choices?.[0]?.message?.content || "No result";
      showToast(`Image ${imageIndex + 1} analysis complete!`, "success");
      // Do something with resultText, e.g., setTablesData, etc.
      console.log("OpenRouter result:", resultText);
      // You can parse tables from resultText if the prompt is changed to extract tables.
    } catch (error) {
      console.error("Error analyzing image with OpenRouter:", error);
      showToast(`Error processing image ${imageIndex + 1}`, "error");
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
    imageIndex,
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
            (r) =>
              r.imageIndex === imageIndex &&
              r.tableIndex === tableIndex &&
              r.rowIndex === rowIndex
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

  const handleDownloadJSON = (imageIndex) => {
    const jsonOutput = jsonOutputs[imageIndex];
    if (!jsonOutput) return;
    const blob = new Blob([jsonOutput], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tables_data_image_${imageIndex + 1}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`JSON file for image ${imageIndex + 1} downloaded`, "success");
  };

  const handleSaveJSON = async (imageIndex) => {
    const jsonOutput = jsonOutputs[imageIndex];
    if (!jsonOutput) {
      showToast(`No JSON data to save for image ${imageIndex + 1}`, "error");
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
      if (!response.ok)
        throw new Error(`Failed to save JSON for image ${imageIndex + 1}`);
      showToast(
        `JSON for image ${imageIndex + 1} saved successfully!`,
        "success"
      );
    } catch (error) {
      console.error(`Error saving JSON for image ${imageIndex + 1}:`, error);
      showToast(
        `Failed to save JSON for image ${imageIndex + 1}: ${error.message}`,
        "error"
      );
    }
  };

  const handleSubmitSales = async () => {
    if (!jsonOutputs.length || !cNo || !currentDate) {
      showToast("Missing required fields (c_no, Date, or JSON)", "error");
      return;
    }

    try {
      setIsLoading(true);
      const salePromises = jsonOutputs.forEach((jsonOutput, imageIndex) => {
        const parsedJson = JSON.parse(jsonOutput);
        if (!parsedJson.tables || !Array.isArray(parsedJson.tables)) {
          showToast(
            `Invalid JSON structure for image ${imageIndex + 1}`,
            "error"
          );
          return;
        }

        const c_name = shopName;
        parsedJson.tables.forEach((table, tableIndex) => {
          const headers = tablesData[imageIndex][tableIndex][0];
          console.log(
            `Image ${imageIndex} Table ${tableIndex} Headers:`,
            headers
          );

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
              tablesData[imageIndex][tableIndex][rowIndex + 1][
                headers.length - 1
              ];

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
                ? tablesData[imageIndex][tableIndex][rowIndex + 1][productIndex]
                : null);
            const productName =
              typeof productNameRaw === "string"
                ? productNameRaw.trim()
                : productNameRaw;

            const rate =
              rateIndex !== -1
                ? Number(
                    tablesData[imageIndex][tableIndex][rowIndex + 1][
                      rateIndex
                    ] || 0
                  )
                : 0;
            const qty =
              outSaleIndex !== -1
                ? Number(
                    tablesData[imageIndex][tableIndex][rowIndex + 1][
                      outSaleIndex
                    ] || 0
                  )
                : 0;
            const counterTransfer =
              counterTransferIndex !== -1
                ? Number(
                    tablesData[imageIndex][tableIndex][rowIndex + 1][
                      counterTransferIndex
                    ] || 0
                  )
                : 0;

            console.log(
              `Row ${rowIndex} in Table ${tableIndex} of Image ${imageIndex}:`,
              {
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
              }
            );

            if (
              productName &&
              !productName.toLowerCase().includes("total") &&
              !isNaN(rate) &&
              rate > 0 &&
              !isNaN(qty) &&
              qty > 0
            ) {
              const saleParams = new URLSearchParams({
                c_no: cNo,
                c_name: encodeURIComponent(c_name),
                p_name: encodeURIComponent(productName),
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
                        `Failed to submit sale for ${productName} in image ${
                          imageIndex + 1
                        }: ${errorMessage}`
                      );
                    }
                    return {
                      productName,
                      success: true,
                      type: "sale",
                      imageIndex,
                    };
                  })
                  .catch((err) => ({
                    productName,
                    success: false,
                    error: err.message,
                    type: "sale",
                    imageIndex,
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
                        `Failed to submit counter transfer for ${productName} in image ${
                          imageIndex + 1
                        }: ${errorMessage}`
                      );
                    }
                    return {
                      productName,
                      success: true,
                      type: "transfer",
                      imageIndex,
                    };
                  })
                  .catch((err) => ({
                    productName,
                    success: false,
                    error: err.message,
                    type: "transfer",
                    imageIndex,
                  }))
              );
            }
          });
        });
      });

      if (salePromises.length === 0) {
        showToast(
          "No valid rows to submit. Ensure rows have valid product names, Rate, and Out Sale or Counter Transfer values.",
          "warning"
        );
        setIsLoading(false);
        return;
      }

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
            `Failed to submit ${f.type} for ${f.productName} in image ${
              f.imageIndex + 1
            }: ${f.error}`,
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

  const canEditRow = () => {
    return true; // Allow editing for all rows
  };

  const handleEditRow = (imageIndex, tableIndex, rowIndex) => {
    const rowData = tablesData[imageIndex][tableIndex][rowIndex + 1];
    setEditingRow({ imageIndex, tableIndex, rowIndex });
    setEditValues([...rowData.slice(0, rowData.length - 1)]); // Exclude validation column
  };

  const handleSaveEdit = async (imageIndex, tableIndex, rowIndex) => {
    try {
      const updatedTables = [...tablesData];
      const headers = updatedTables[imageIndex][tableIndex][0];
      const oldRow = [...tablesData[imageIndex][tableIndex][rowIndex + 1]];
      const validationTypes = ["Validation"];

      // Sanitize and update the row with edited values
      const sanitizedEditValues = editValues.map((value, i) => {
        if (
          headers[i]
            .toLowerCase()
            .match(/rate|out sale|amount|o\.b|ksbcl receipt/) &&
          value === "-"
        ) {
          return 0;
        }
        return value;
      });

      updatedTables[imageIndex][tableIndex][rowIndex + 1] = [
        ...sanitizedEditValues,
        ...Array(validationTypes.length).fill(""), // Add empty validation column
      ];

      // Update the tablesData state
      setTablesData(updatedTables);

      // Clear editing state
      setEditingRow(null);
      setEditValues([]);

      // Update JSON output
      const tableJSON = convertTableToJSON(
        updatedTables[imageIndex],
        imageIndex,
        stockResultsState.filter((r) => r.imageIndex === imageIndex),
        true
      );
      setJsonOutputs((prev) => {
        const newJsonOutputs = [...prev];
        newJsonOutputs[imageIndex] = JSON.stringify(tableJSON, null, 2);
        return newJsonOutputs;
      });

      showToast(
        `Row updated successfully in image ${imageIndex + 1}!`,
        "success"
      );
    } catch (error) {
      console.error("Error in handleSaveEdit:", error);
      showToast(
        `Failed to save edit in image ${imageIndex + 1}: ${error.message}`,
        "error"
      );
    }
  };
  const handleDeleteRow = (imageIndex, tableIndex, rowIndex) => {
    const updatedTables = [...tablesData];
    const headers = updatedTables[imageIndex][tableIndex][0];
    const amountIndex = headers.findIndex(
      (h) => typeof h === "string" && h.toLowerCase() === "amount"
    );
    updatedTables[imageIndex][tableIndex].splice(rowIndex + 1, 1);

    const amountValues = amounts.filter(
      (a) =>
        !(
          a.imageIndex === imageIndex &&
          a.tableIndex === tableIndex &&
          a.rowIndex === rowIndex + 1
        )
    );

    if (updatedTables[imageIndex][tableIndex].length > 1) {
      const lastRow =
        updatedTables[imageIndex][tableIndex][
          updatedTables[imageIndex][tableIndex].length - 1
        ];
      if (
        lastRow[0].toLowerCase().includes("total") ||
        lastRow[0].toLowerCase().includes("grand total")
      ) {
        const tableTotal = amountValues
          .filter(
            (a) => a.imageIndex === imageIndex && a.tableIndex === tableIndex
          )
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
      updatedTables[imageIndex],
      imageIndex,
      stockResultsState.filter((r) => r.imageIndex === imageIndex),
      true
    );
    setJsonOutputs((prev) => {
      const newJsonOutputs = [...prev];
      newJsonOutputs[imageIndex] = JSON.stringify(tableJSON, null, 2);
      return newJsonOutputs;
    });
    showToast(
      `Row deleted successfully in image ${imageIndex + 1}!`,
      "success"
    );
  };

  const toggleTooltip = (imageIndex, tableIndex, rowIndex) => {
    const key = `${imageIndex}-${tableIndex}-${rowIndex}`;
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
    tablesData.forEach((imageTables, imageIndex) => {
      if (imageTables && imageTables.length > 0 && imageTables[0].length > 0) {
        const tableJSON = convertTableToJSON(
          imageTables,
          imageIndex,
          stockResultsState.filter((r) => r.imageIndex === imageIndex),
          true
        );
        setJsonOutputs((prev) => {
          const newJsonOutputs = [...prev];
          newJsonOutputs[imageIndex] = JSON.stringify(tableJSON, null, 2);
          return newJsonOutputs;
        });
      }
    });
  }, [tablesData, stockResultsState]);

  const cleanProductName = (name) =>
    typeof name === "string" ? name.replace(/\s*\(\d+\)\s*$/, "").trim() : name;

  const safeProgress = (idx) =>
    typeof progress[idx] === "number" && !isNaN(progress[idx])
      ? progress[idx]
      : 0;

  return (
    <div className="App">
      {/* Toast Notification */}
      {toast.show && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === "success" && (
            <svg
              className="toast-icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          )}
          {toast.type === "error" && (
            <svg
              className="toast-icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          )}
          {toast.type === "info" && (
            <svg
              className="toast-icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          )}
          {toast.type === "warning" && (
            <svg
              className="toast-icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          )}
          <span className="toast-message">{toast.message}</span>
          <button onClick={closeToast} className="toast-close">
            <svg
              className="toast-icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-container">
          <div className="navbar-items flex-row-mobile">
            {typeParam === "Godown" && numberCounter === "2" && (
              <select
                value={type}
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
                multiple
                onChange={handleFileChange}
                className="navbar-upload-input"
                disabled={!cNo}
              />
              <label htmlFor="fileInput" className="navbar-upload-label">
                <svg
                  className="toast-icon"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
                Upload Images
              </label>
            </div>
          </div>
          {error && (
            <div className="error-message">
              <svg
                className="toast-icon"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              {error}
            </div>
          )}
        </div>
      </nav>
      {/* Image and Table Sections */}
      {images.map((image, imageIndex) => (
        <div key={`image-${imageIndex}`} className="card fade-in">
          <h2 className="section-title">Image {imageIndex + 1} Preview</h2>
          {/* Progress Bar */}
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
          {/* Image Preview */}
          <div className="image-preview-container">
            <img
              src={image.url}
              alt={`Uploaded ${imageIndex + 1}`}
              className="image-preview"
            />
          </div>
          {/* Tables */}
          {tablesData[imageIndex] &&
            tablesData[imageIndex].length > 0 &&
            tablesData[imageIndex][0].length > 0 && (
              <div className="tables-container">
                <div className="card-header">
                  <h3 className="section-title">
                    Extracted Data Tables for Image {imageIndex + 1}
                  </h3>
                </div>
                <div>
                  {tablesData[imageIndex].map((table, tableIndex) => (
                    <div
                      key={`table-${imageIndex}-${tableIndex}`}
                      className="table-wrapper"
                    >
                      <h4 className="table-title">Table {tableIndex + 1}</h4>
                      <div className="table-responsive">
                        <table className="data-table">
                          <thead>
                            <tr className="bg-gray-50">
                              {table[0].map((header, index) => (
                                <th
                                  key={`header-${imageIndex}-${tableIndex}-${index}`}
                                  className="border border-gray-200 p-2 text-left text-sm font-medium"
                                >
                                  {header || `Column ${index + 1}`}
                                </th>
                              ))}
                              <th className="border border-gray-200 p-2 text-left text-sm font-medium">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const dataRows = table.slice(1);
                              // Filter rows to include only those with at least one non-zero numeric value (excluding validation column)
                              const filteredRows = dataRows.filter((row) =>
                                row
                                  .slice(0, table[0].length - 1)
                                  .some(
                                    (cell, i) =>
                                      table[0][i]
                                        .toLowerCase()
                                        .match(
                                          /rate|out sale|amount|o\.b|ksbcl receipt|cou\. trsfer|cou\ntrsfer/
                                        ) &&
                                      !isNaN(cell) &&
                                      cell !== "" &&
                                      Number(cell) !== 0
                                  )
                              );

                              const correctRows = filteredRows.filter(
                                (row) =>
                                  row[table[0].length - 1] === "Correct" ||
                                  row[table[0].length - 1] === "Total: Correct"
                              );
                              const errorRows = filteredRows.filter(
                                (row) =>
                                  row[table[0].length - 1] !== "Correct" &&
                                  row[table[0].length - 1] !== "Total: Correct"
                              );
                              const sortedRows = [...correctRows, ...errorRows];
                              return sortedRows.map((row, rowIndex) => {
                                const validationValue =
                                  row[table[0].length - 1];
                                const isError =
                                  validationValue !== "Correct" &&
                                  validationValue !== "Total: Correct";
                                const isEditing =
                                  editingRow &&
                                  editingRow.imageIndex === imageIndex &&
                                  editingRow.tableIndex === tableIndex &&
                                  editingRow.rowIndex === rowIndex;

                                const productIndex = table[0].findIndex(
                                  (h) =>
                                    typeof h === "string" &&
                                    (h.toLowerCase() === "name of brands" ||
                                      h.toLowerCase() === "product" ||
                                      h.toLowerCase() === "item")
                                );

                                return (
                                  <tr
                                    key={`row-${imageIndex}-${tableIndex}-${rowIndex}`}
                                    className="hover:bg-gray-50"
                                  >
                                    {row.map((cell, cellIndex) => (
                                      <td
                                        key={`cell-${imageIndex}-${tableIndex}-${rowIndex}-${cellIndex}`}
                                        className={`border border-gray-200 p-2 ${
                                          cellIndex === table[0].length - 1
                                            ? "validation-cell"
                                            : ""
                                        }`}
                                        style={
                                          cellIndex === productIndex && isError
                                            ? {
                                                color: "#dc2626",
                                                fontWeight: 600,
                                              }
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
                                              newValues[cellIndex] =
                                                e.target.value;
                                              setEditValues(newValues);
                                            }}
                                          />
                                        ) : isEditing &&
                                          cellIndex === table[0].length - 1 ? (
                                          <div
                                            style={{
                                              color: "#dc2626",
                                              fontWeight: 500,
                                              fontSize: "0.95em",
                                              userSelect: "all",
                                              whiteSpace: "pre-line",
                                            }}
                                          >
                                            {validationValue ||
                                              "No error details available"}
                                          </div>
                                        ) : cellIndex ===
                                          table[0].length - 1 ? (
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
                                                `${imageIndex}-${tableIndex}-${rowIndex}`
                                              }
                                              overlay={
                                                <Tooltip>
                                                  <span
                                                    style={{
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
                                                    imageIndex,
                                                    tableIndex,
                                                    rowIndex
                                                  )
                                                }
                                                style={{ color: "inherit" }}
                                              >
                                                <Eye
                                                  style={{
                                                    color: "currentColor",
                                                  }}
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
                                    <td className="border border-gray-200 p-2">
                                      {isEditing ? (
                                        <div className="flex-row-mobile">
                                          <OverlayTrigger
                                            placement="top"
                                            overlay={
                                              <Tooltip>Save Changes</Tooltip>
                                            }
                                          >
                                            <Button
                                              className="action-icon action-icon-save"
                                              size="sm"
                                              onClick={() =>
                                                handleSaveEdit(
                                                  imageIndex,
                                                  tableIndex,
                                                  rowIndex
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
                                            overlay={
                                              <Tooltip>Edit Row</Tooltip>
                                            }
                                          >
                                            <Button
                                              className="action-icon action-icon-edit"
                                              size="sm"
                                              onClick={() =>
                                                handleEditRow(
                                                  imageIndex,
                                                  tableIndex,
                                                  rowIndex
                                                )
                                              }
                                              disabled={
                                                editingRow !== null ||
                                                !canEditRow(
                                                  imageIndex,
                                                  tableIndex,
                                                  rowIndex
                                                )
                                              }
                                            >
                                              <PencilSquare />
                                            </Button>
                                          </OverlayTrigger>
                                          <OverlayTrigger
                                            placement="top"
                                            overlay={
                                              <Tooltip>Delete Row</Tooltip>
                                            }
                                          >
                                            <Button
                                              className="action-icon action-icon-delete"
                                              size="sm"
                                              variant="danger"
                                              onClick={() =>
                                                handleDeleteRow(
                                                  imageIndex,
                                                  tableIndex,
                                                  rowIndex
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
                            {editingRow &&
                              editingRow.imageIndex === imageIndex &&
                              editingRow.tableIndex === tableIndex &&
                              table[editingRow.rowIndex + 1] &&
                              (() => {
                                const validationValue =
                                  table[editingRow.rowIndex + 1][
                                    table[0].length - 1
                                  ];
                                const isError =
                                  validationValue !== "Correct" &&
                                  validationValue !== "Total: Correct";
                                if (isError) {
                                  return (
                                    <tr>
                                      <td
                                        colSpan={table[0].length + 1}
                                        style={{
                                          background: "#fff3cd",
                                          color: "#856404",
                                          padding: "8px",
                                          borderRadius: "4px",
                                          marginTop: "4px",
                                          fontSize: "0.95em",
                                          userSelect: "all",
                                          whiteSpace: "pre-line",
                                        }}
                                      >
                                        {validationValue}
                                      </td>
                                    </tr>
                                  );
                                }
                                return null;
                              })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="action-buttons">
                  <button
                    className="action-button btn-primary"
                    onClick={handleSubmitSales}
                    disabled={
                      !jsonOutputs.length || !cNo || !currentDate || isLoading
                    }
                  >
                    <svg
                      className="toast-icon"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                      <polyline points="17 21 17 13 7 13 7 21" />
                      <polyline points="7 3 7 8 15 8" />
                    </svg>
                    Final Submit
                  </button>
                </div>
              </div>
            )}
        </div>
      ))}
      {/* Add New Image Button */}

      {/* <div className="flex-justify-center mt-6">
        <input
          id="fileInputNew"
          type="file"
          accept="image/*"
          multiple={false}
          onChange={handleFileChange}
          className="navbar-upload-input"
          disabled={!cNo}
          style={{ display: "none" }}
        />
        <label
          htmlFor="fileInputNew"
          className="add-image-btn"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: "#2563eb",
            color: "#fff",
            padding: "10px 20px",
            borderRadius: "6px",
            cursor: cNo ? "pointer" : "not-allowed",
            fontWeight: 600,
            fontSize: "1rem",
            boxShadow: "0 2px 8px rgba(37,99,235,0.08)",
            border: "none",
            opacity: cNo ? 1 : 0.6,
            transition: "background 0.2s",
          }}
        >
          <svg
            className="toast-icon"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 16V4M8 8l4-4 4 4M4 20h16" />
          </svg>
          + Add New Image
        </label>
      </div> */}
      {/* Final Submit Button */}
    </div>
  );
}

export default MultiImage;

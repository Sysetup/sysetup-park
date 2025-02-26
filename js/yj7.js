(() => {

    // Initialize components
    const init = () => {
        updateClock();
        outputLogo();
        fetchGeoData();
        fetchGithubRepos();
        displayRandomDescription();
    };
    
    // Clock functionality
    const updateClock = () => {
        const timeElement = document.querySelector(".time");
        const dateElement = document.querySelector(".date");
        const weekdays = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
        
        const padNumber = (num, places) => String(num).padStart(places, '0');
        
        const updateTime = () => {
            const now = new Date();
            const hours = padNumber(now.getHours(), 2);
            const minutes = padNumber(now.getMinutes(), 2);
            const seconds = padNumber(now.getSeconds(), 2);
            const year = now.getFullYear();
            const month = padNumber(now.getMonth() + 1, 2);
            const day = padNumber(now.getDate(), 2);
            const weekday = weekdays[now.getDay()];
            
            timeElement.innerHTML = `${hours}:${minutes}:${seconds}`;
            dateElement.innerHTML = `${year}-${month}-${day} ${weekday}`;
        };
        
        // Update time immediately and then every second
        updateTime();
        setInterval(updateTime, 1000);
    };

    // ASCII art console output
    const outputLogo = () => {
        console.info("   ____             __\n  / __/_ _____ ___ / /___ _____ _/|\n _\\ \\/ // (_-</ -_) __/ // / _ > _<\n/___/\\_, /___/\\__/\\__/\\_,_/ .__//\n    /___/                /_/       \n> Systems development company.");
    };

    // Fetch geo-location data for visitor
    const fetchGeoData = () => {
        const connectionsElement = document.getElementById('connections');
        let messageIndex = 0;
        let charIndex = 0;
        let typingInterval;

        const API_KEY = '10b820f925acc9303a95cf7e709c212f2aa244e2';
        
        fetch(`https://api.getgeoapi.com/v2/ip/check?api_key=${API_KEY}&format=json`)
            .then(response => response.json())
            .then(data => {
                const firstLanguage = Object.keys(data.country.languages)[0];
                const messages = [
                    'IP Address: ' + data.ip, 'IP Type: ' + data.type, 'ISP location latitude: ' + data.location.latitude, 'ISP location longitude: ' + data.location.longitude, 'ISP Postal code: ' + data.postcode, 'ISP area code: ' + data.area.code, 'ISP area geoname id: ' + data.area.geonameid, 'ISP Area: ' + data.area.name, 'ASN number: ' + data.asn.number, 'ASN organization: ' + data.asn.organisation, 'City geoname id: ' + data.city.geonameid, 'City name: ' + data.city.name, 'City population: ' + data.city.population, 'Continent geoname id: ' + data.continent.geonameid, 'Continent name: ' + data.continent.name, 'Data continent code: ' + data.continent.code, 'Country geonameid: ' + data.country.geonameid, 'Country name: ' + data.country.name, 'Country code: ' + data.country.code, 'Country capital: ' + data.country.capital, 'Country area size: ' + data.country.area_size, 'Country population: ' + data.country.population, 'Country phone code: ' + data.country.phone_code, 'Country languajes: ' + data.country.languages[firstLanguage], 'Country flag: ' + data.country.flag.emoji, 'Country tld: ' + data.country.tld, 'Currency code: ' + data.currency.code, 'Currency name: ' + data.currency.name, 'Use tor: ' + data.security.is_tor, 'Use proxy: ' + data.security.is_proxy, 'Use a crawler: ' + data.security.is_crawler, 'Time zone: ' + data.time.timezone, 'Time gtm_offset: ' + data.time.gtm_offset, 'Time gmt_offset: ' + data.time.gmt_offset, 'Data time code: ' + data.time.code
                ];
                
                console.table(messages);
                shuffleArray(messages);
                
                const typeMessage = () => {
                    if (charIndex < messages[messageIndex].length) {
                        connectionsElement.innerHTML += messages[messageIndex][charIndex];
                        charIndex++;
                    } else {
                        messageIndex++;
                        charIndex = 0;
                        
                        clearInterval(typingInterval);
                        
                        setTimeout(() => {
                            connectionsElement.innerHTML = " ";
                            
                            if (messageIndex >= messages.length) {
                                messageIndex = 0;
                                shuffleArray(messages);
                            }
                            
                            typingInterval = setInterval(typeMessage, 123);
                        }, 1500);
                    }
                };
                
                typingInterval = setInterval(typeMessage, 123);
            })
            .catch(error => {
                console.error('Error fetching geo data:', error);
            });
    };

    // GitHub repository code fetching
    const fetchGithubRepos = () => {
        const backgroundElement = document.getElementById('background');
        const urls = [];
        let urlIndex = 0;
        let elementId = 0;
        
        // GitHub API - Note: Token should be removed or secured
        const GITHUB_TOKEN = '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';
        
        fetch('https://api.github.com/users/sysetup/repos', {
            headers: {
                Authorization: `${GITHUB_TOKEN}`
            }
        })
            .then(response => response.json())
            .then(repos => {
                const fetchPromises = repos.map(repo => 
                    fetch(`https://api.github.com/repos/Sysetup/${repo.name}/contents`)
                        .then(response => response.json())
                        .then(files => {
                            files.forEach(file => {
                                const fileUrl = file.download_url;
                                if (fileUrl && isCodeFile(fileUrl)) {
                                    urls.push(fileUrl);
                                }
                                
                                if (file.path === 'js') {
                                    return fetch(`https://api.github.com/repos/Sysetup/${repo.name}/contents/js`)
                                        .then(response => response.json())
                                        .then(jsFiles => {
                                            jsFiles.forEach(jsFile => {
                                                if (jsFile.download_url) {
                                                    urls.push(jsFile.download_url);
                                                }
                                            });
                                        });
                                }
                            });
                        })
                        .catch(error => {
                            console.error(`Error fetching repo contents for ${repo.name}:`, error);
                        })
                );
                
                return Promise.all(fetchPromises);
            })
            .then(() => {
                return fetch('https://api.github.com/users/sysetup/gists');
            })
            .then(response => response.json())
            .then(gists => {
                gists.forEach(gist => {
                    Object.keys(gist.files).forEach(fileName => {
                        urls.push(gist.files[fileName].raw_url);
                    });
                });
                
                shuffleArray(urls);
                
                // Fetch and display all code files
                urls.forEach(url => {
                    fetch(url)
                        .then(response => response.text())
                        .then(code => {
                            displayCode(code, backgroundElement, ++elementId, urls.length);
                        })
                        .catch(error => {
                            console.error(`Error fetching file from ${url}:`, error);
                        });
                });
            })
            .catch(error => {
                console.error('Error fetching GitHub data:', error);
            });
    };
    
    // Helper function to check if file is a code file
    const isCodeFile = (url) => {
        const fileExtension = url.split('.').pop().toLowerCase();
        return ['js', 'md', 'sh', 'ml', 'html', 'css', 'py', 'java', 'rb', 'php'].includes(fileExtension);
    };
    
    // Display code in background with syntax highlighting
    const displayCode = (code, container, id, totalFiles) => {
        const highlightedCode = hljs.highlightAuto(code).value;
        
        const codeDiv = document.createElement("div");
        codeDiv.id = id;
        codeDiv.innerHTML = highlightedCode;
        
        const spacerDiv = document.createElement("div");
        spacerDiv.id = 'space';
        
        container.appendChild(spacerDiv);
        container.appendChild(codeDiv);
        
        if (id >= totalFiles) {
            container.appendChild(spacerDiv.cloneNode());
            setupScrolling(container.scrollHeight);
        }
    };
    
    // Setup auto-scrolling for code background
    const setupScrolling = (totalHeight) => {
        const backgroundElement = document.getElementById('background');
        const scrollStep = 11;
        const viewportHeight = 843; // Approximate visible height
        const maxScrollTop = totalHeight - viewportHeight;
        
        setInterval(() => {
            if (backgroundElement.scrollTop < maxScrollTop) {
                backgroundElement.scrollBy({
                    top: scrollStep,
                    behavior: "smooth"
                });
            } else {
                backgroundElement.scrollTop = 0;
            }
        }, 76);
    };
    
    // Display random marketing text
    const displayRandomDescription = () => {
        const descriptions = [
            "Innovative solutions for system creation and optimization.",
            "Empowering businesses through cutting-edge system creation and optimization.",
            "Building tomorrow's success with optimized systems and creative solutions.",
            "Elevating performance through strategic system creation and optimization.",
            "Unlocking potential with optimized systems and innovative creation strategies.",
            "Driving excellence through customized system creation and optimization.",
            "Transforming possibilities into realities with advanced system creation and optimization.",
            "Creation and optimization systems.",
            "SYSETUP is a veteran in the IT industry, delivering full-cycle services in systems development for more than 18 years.",
            "For over 18 years, SYSETUP has been offering global IT solutions, specializing in full-cycle systems development services.",
            "With 18+ years of industry expertise, SYSETUP provides comprehensive IT solutions, specializing in systems development.",
            "SYSETUP is a prominent global IT solutions provider, specializing in systems development and full-cycle services with over 18 years of experience.",
            "For more than 18 years, SYSETUP has been delivering end-to-end IT solutions with a focus on systems development, establishing itself as a leading global provider.",
            "As a global IT solutions provider with over 18 years of experience, SYSETUP specializes in full-cycle services, including systems development, to meet the ever-evolving demands of the industry.",
            "SYSETUP's 18+ years of experience in the IT industry has allowed them to specialize in full-cycle services, particularly in systems development, making them a prominent global provider."
        ];
        
        const randomIndex = Math.floor(Math.random() * descriptions.length);
        document.getElementById("description").innerHTML = descriptions[randomIndex];
    };
    
    // Helper function to shuffle array
    const shuffleArray = (array) => {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    };
    
    // Start the application
    init();
})();
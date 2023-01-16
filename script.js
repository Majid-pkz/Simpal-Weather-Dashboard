
var userGeneratedUrl=""
var geoUrl=""
var lat=0;
var lon=0;
var country="";
var cityName;

const apiKey="";

// local time displayed at the header 
var localTimeEl= $("#local-time");
 function displayLocalTime(){
    var localTimeValue=dayjs().format('MMM DD, YYYY [at] HH');
    localTimeEl.text(localTimeValue); }
 displayLocalTime();
 setInterval(displayTime, 1000); 
 var currentTimeEl= document.getElementById("current-time");
function displayTime() {
    var rightNow = dayjs().format('MMM DD, YYYY ');    
    currentTimeEl.textContent="( "+ rightNow+" )" 
  }
  displayTime();
  setInterval(displayTime, 1000); 

// get elements by Id-----------------------------------------------------------------
  var todayTempEl=document.getElementById('today-temp')
  var todayWindEl=document.getElementById('today-wind')
  var todayHumidityEl= document.getElementById('today-humidity')

  var day1TempEl=document.getElementById('day1-temp')
  var day1WindEl=document.getElementById('day1-wind')
  var day1HumidityEl=document.getElementById('day1-humidity')

  var day2TempEl=document.getElementById('day2-temp')
  var day2WindEl= document.getElementById('day2-wind')
  var day2HumidityEl=document.getElementById('day2-humidity')

  var day3TempEl=document.getElementById('day3-temp')
  var day3WindEl= document.getElementById('day3-wind')
  var day3HumidityEl=document.getElementById('day3-humidity')

  var day4TempEl=document.getElementById('day4-temp')
  var day4WindEl= document.getElementById('day4-wind')
  var day4HumidityEl=document.getElementById('day4-humidity')

  var day5TempEl=document.getElementById('day5-temp')
  var day5WindEl= document.getElementById('day5-wind')
  var day5HumidityEl=document.getElementById('day5-humidity')

  var cityList = document.querySelector("#city-list");
  //----------------------------------------------------------------------------------------
  
var inputEl=document.getElementById("user-input");
var cityDisplayEl= document.getElementById("main-city");


function captureCityName(event){
    event.preventDefault();
 
   var cityTyped=inputEl.value
   userGeneratedUrl="http://api.openweathermap.org/geo/1.0/direct?q="+cityTyped+"&limit=2&appid=8c2432d7de8348b1ad8d9b6d6fb89aea"
   addToHistory();
   fetch(userGeneratedUrl).then(data=>{
    console.log(data)
    return data.json()
     
    })
    .then(resp1=>{
      console.log(resp1)
      lat=resp1[0].lat
      lon=resp1[0].lon
      country=resp1[0].country
      cityName=resp1[0].name
             
      cityDisplayEl.textContent=cityName;
      // create a api based on city entered by user
      geoUrl="https://api.openweathermap.org/data/2.5/forecast?lat="+lat+"&lon="+lon+"&appid=8c2432d7de8348b1ad8d9b6d6fb89aea"+"&units=metric"
      
      fetch(geoUrl).then(dataaa=>{
        console.log(dataaa)
        return dataaa.json()
         
        })
        .then(respons=>{
                console.log(respons)
             
              return respons.list
              }) 
              .then(info=>{
                // to filter the tepm at different time of the day 6:00 am  12 pm and 18:00 
                console.log(info)
                var timeSlot=12;
                if(dayjs().format(' HH')<9){
                  timeSlot=6;                 
                }
                if(dayjs().format(' HH')>=9&& dayjs().format(' HH')<18){
                  timeSlot=12;                 
                }
                if( dayjs().format(' HH')>=18){
                  timeSlot=18;
                }              


                var timeInt=parseInt(dayjs().format(' HH'))
                var timeText=dayjs().format(' HH')
                var minText=":00:00"
             
                  for(var i=0;i<info.length;i++){

                  if(info[i].dt_txt.includes((timeSlot+':00:00')))
                  {
                   todayTemp=info[i].main.temp;
                   todayWind=info[i].wind.speed;
                   todayHumidity=info[i].main.humidity                  
                  
                   todayTempEl.textContent=todayTemp;
                   todayWindEl.textContent=todayWind;
                   todayHumidityEl.textContent=todayHumidity;
                  }
                  var day1= dayjs().add(1,'day').format('YYYY-MM-DD');
                  if(info[i].dt_txt.includes(day1)&& info[i].dt_txt.includes((timeSlot+':00:00'))){
                    day1Temp=info[i].main.temp;
                    day1Wind=info[i].wind.speed;
                    day1Humidity=info[i].main.humidity ;
                    console.log(day1Temp);
                    console.log(day1Wind);
                    console.log(day1Humidity);

                    day1TempEl.textContent=day1Temp;
                    day1WindEl.textContent=day1Wind;
                    day1HumidityEl.textContent=day1Humidity;
                  }
                  var day2= dayjs().add(2,'day').format('YYYY-MM-DD');
                  if(info[i].dt_txt.includes(day2)&& info[i].dt_txt.includes((timeSlot+':00:00'))){
                    day2Temp=info[i].main.temp;
                    day2Wind=info[i].wind.speed;
                    day2Humidity=info[i].main.humidity ;  

                    day2TempEl.textContent=day2Temp;
                    day2WindEl.textContent=day2Wind;
                    day2HumidityEl.textContent=day2Humidity;
                  }
                  var day3= dayjs().add(3,'day').format('YYYY-MM-DD');
                  if(info[i].dt_txt.includes(day3)&& info[i].dt_txt.includes((timeSlot+':00:00'))){
                    day3Temp=info[i].main.temp;
                    day3Wind=info[i].wind.speed;
                    day3Humidity=info[i].main.humidity ;
                    
                    day3TempEl.textContent=day3Temp;
                    day3WindEl.textContent=day3Wind;
                    day3HumidityEl.textContent=day3Humidity;
                  }
                  var day4= dayjs().add(4,'day').format('YYYY-MM-DD');
                  if(info[i].dt_txt.includes(day4)&& info[i].dt_txt.includes((timeSlot+':00:00'))){
                    day4Temp=info[i].main.temp;
                    day4Wind=info[i].wind.speed;
                    day4Humidity=info[i].main.humidity ;
                    
                    day4TempEl.textContent=day4Temp;
                    day4WindEl.textContent=day4Wind;
                    day4HumidityEl.textContent=day4Humidity;
                  }
                  var day5= dayjs().add(5,'day').format('YYYY-MM-DD');
                  if(info[i].dt_txt.includes(day5)&& info[i].dt_txt.includes((timeSlot+':00:00'))){
                    day5Temp=info[i].main.temp;
                    day5Wind=info[i].wind.speed;
                    day5Humidity=info[i].main.humidity ;
                    
                    day5TempEl.textContent=day5Temp;
                    day5WindEl.textContent=day5Wind;
                    day5HumidityEl.textContent=day5Humidity;
                  }

                }
              })              

           })        
           


}

// Event listnener for search button
var searchButtonEL=document.getElementById("search-btn")
searchButtonEL.addEventListener("click",captureCityName)


var searchHistoryArray=[]

function storeSearchValue() {
  // Stringify and set key in localStorage 
  localStorage.setItem("historyKey", JSON.stringify(searchHistoryArray));
}

function addToHistory(){
 
    var history = inputEl.value.trim();
  
    // Return from function early if input is blank
    if (history === "") {
      return;
    }
  
    // Add new city to searchHistory array, clear the input
    if(!searchHistoryArray.includes(inputEl.value.trim())) {
      searchHistoryArray.push(history);
      inputEl.value = "";
    }
   
  
    // Store updated todos in localStorage, re-render the list
       storeSearchValue();
       renderCity();
  }


  
  
// The following function renders items in a  list as <li> elements
function renderCity() {
  // Clear cityList element 
  cityList.innerHTML = ""; 

  // Render a new list for each todo
  for (var i = 0; i < searchHistoryArray.length; i++) {
    var city = searchHistoryArray[i];

    var li = document.createElement("li");
    li.textContent = city;
    li.setAttribute("data-index", i); 
      
  cityList.appendChild(li);
  
  }
}
// This function  will run when the page loads.
function init() {
  // Get stored cities from localStorage
  var storedCity = JSON.parse(localStorage.getItem("historyKey"));

  // If searchhistoryArray  were retrieved from localStorage, update it
  if (storedCity !== null) {
    searchHistoryArray = storedCity;
  }  
  renderCity();
}




init();

// Autocoplete limited version only a few city stored in an array  just for testing

$( function() {
    var availableTags = ["Sydney","perth","adelaide", 'tehran' ];
    $( "#user-input" ).autocomplete({
      source: availableTags
    });
  } );

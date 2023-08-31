import { existsSync, readFileSync, writeFileSync } from "fs";
import puppeteer, { Page } from "puppeteer";

interface Hotel {
    name: string;
    score: string;
    address?: string;
    url: string;
}

const keywords = [
    "Gramado, Rio Grande do Sul, Brazil",
    "Parati, Rio de Janeiro State, Brazil",
    "Fernando de Noronha, Pernambuco, Brazil",
    "São Paulo, São Paulo State, Brazil",
    "Rio de Janeiro, Rio de Janeiro State, Brazil",
    "Fortaleza, Ceará, Brazil",
    "Porto Seguro, Bahia, Brazil",
    "Arraial D’Ajuda, Bahia, Brazil",
    "Trancoso, Bahia, Brazil",
    "Itacaré, Bahia, Brazil",
    "Visconde de Mauá, Rio de Janeiro State, Brazil",
    "Garopaba, Santa Catarina, Brazil",
    "Ilhéus, Bahia, Brazil",
    "Monte Verde, Minas Gerais, Brazil",
    "Campos do Jordão, São Paulo, Brazil",
    "São Sebastião, São Paulo, Brazil",
    "Ubatuba, São Paulo, Brazil",
    "Brasília, Distrito Federal, Brazil",
    "Caldas Novas, Goiás, Brazil",
    "Salvador, Bahia, Brazil",
    "Búzios, Rio de Janeiro State, Brazil",
    "Itaipava, Rio de Janeiro State, Brazil",
    "Teresópolis, Rio de Janeiro State, Brazil",
    "Petrópolis, Rio de Janeiro State, Brazil",
    "Curitiba, Paraná, Brazil",
    "Santos, São Paulo State, Brazil",
    "Belém, Pará, Brazil",
    "Recife, Pernambuco, Brazil",
    "Porto de Galinhas, Pernambuco, Brazil",
    "Florianópolis, Santa Catarina, Brazil",
    "Maceió, Alagoas, Brazil",
    "Bombinhas, Santa Catarina, Brazil",
    "Cabo Frio, Rio de Janeiro State, Brazil",
    "Guarujá, São Paulo State, Brazil",
    "Balneário Camboriú, Santa Catarina, Brazil",
    "Natal, Rio Grande do Norte, Brazil",
    "Arraial do Cabo, Rio de Janeiro State, Brazil",
    "Canela, Rio Grande do Sul, Brazil",
    "Ilhabela, São Paulo State, Brazil",
    "Penha, Santa Catarina, Brazil",
    "Pipa, Rio Grande do Norte, Brazil",
    "Barreirinhas, Maranhão, Brazil",
    "São Luís, Maranhão, Brazil",
    "Jericoacoara, Jijoca de Jericoacoara, Ceará, Brazil"
]

const sleep = (time: number) => new Promise((resolve, reject) => {
    setTimeout(() => {
        resolve("");
    }, time);
})

const loadHotelList = async (page: Page) => {

    const gotoSearchPage = async (keyword: string) => {
        const searchInputButton = await page.waitForSelector('[data-stid="destination_form_field-dialog-trigger"]');
        await searchInputButton?.click();

        for (let i = 0; i < 5; i++) {
            try {
                const searchInput = await page.waitForSelector('[id="destination_form_field"]');
                await searchInput?.click();
                await sleep(1000);
                const inputValue = await page.$eval('input[id="destination_form_field"]', el => el.value);
                for (let i = 0; i < inputValue.length; i++) await page.keyboard.press("Backspace");
                for (let i = 0; i < inputValue.length; i++) await page.keyboard.press("Delete");
                await searchInput?.type(keyword, {
                    delay: 5
                });

                const dropdown = await page.waitForSelector('ul[data-stid="destination_form_field-results"] > li:nth-child(1) > div', {
                    timeout: 5000
                });
                await sleep(1000);
                await dropdown?.click();
                await page.waitForSelector('section[role=dialog]', {
                    hidden: true
                });
                break;
            } catch (error) {
                console.log(`input autocomplete failed. ${i + 1}`)
            }
        }

        const searchButton = await page.waitForSelector('[id="search_button"]');
        await searchButton?.click();

        await page.waitForNavigation({
            timeout: 0
        });
        try {
            const cookieAcceptButton = await page.waitForSelector('[class=" osano-cm-accept-all osano-cm-buttons__button osano-cm-button osano-cm-button--type_accept "]', {
                timeout: 10000
            });
            await cookieAcceptButton?.click();
        } catch (error) {

        }
    }

    const getList = async () => {
        const hotels: Hotel[] = [];
        while (1) {
            try {
                await page.evaluate(() => {
                    window.scrollBy(0, window.innerHeight);
                })
                const showMoreButton = await page.waitForSelector('[data-stid="show-more-results"]', {
                    timeout: 10000
                });
                await showMoreButton?.click();
                await page.waitForSelector('span[class="uitk-loader uitk-loader-page is-visible"]', {
                    hidden: true,
                    timeout: 120000
                })
                await page.evaluate(() => {
                    window.scrollBy(0, window.innerHeight);
                })
            } catch (error) {
                break;
            }
            await sleep(3000);
        }
        await page.waitForSelector('[data-stid="property-listing-results"]');
        const ret = await page.evaluate(() => {
            const hotels: Hotel[] = [];
            const parent = window.document.querySelector('[data-stid="property-listing-results"]');
            const childs = parent?.querySelectorAll('div[class="uitk-spacing uitk-spacing-margin-blockstart-three"]');

            childs?.forEach(element => {
                let link = element.querySelector('a[data-stid="open-hotel-information"]')?.getAttribute("href") || "";
                link = `https://www.hotels.com${link}`;
                const name = element.querySelector("h4")?.innerText || "";
                if (name.length) hotels.push({
                    name: name,
                    url: link,
                    score: ""
                })
            })
            return hotels;
        });

        return ret;
    }

    for (let i = 0; i < keywords.length; i++) {
        const filePath = `output/list/${keywords[i]}.json`;
        try {
            console.log(`${keywords.length} / ${i + 1} started`);
            if (existsSync(filePath)) continue;
            await gotoSearchPage(keywords[i]);
            const list = await getList();
            writeFileSync(filePath, JSON.stringify(list));
        } catch (error) {
            i--;
            console.log(`error to get list ${keywords[i]}`, error);
        }
    }
    console.log('done listing');
}

const getFullInformationFromList = async (page: Page) => {

    const keywordHotelList: { keyword: string, hotels: Hotel[] }[] = [];
    let total = 0;
    for (let i = 0; i < keywords.length; i++) {
        try {
            const infoFilePath = `output/list/${keywords[i]}.json`;
            const hotels: Hotel[] = JSON.parse(readFileSync(infoFilePath).toString());
            keywordHotelList.push({
                keyword: keywords[i],
                hotels
            });
            total += hotels.length;
        } catch (error) {
            console.log(`error getting hotel list ${i + 1}: ${keywords[i]}`);
        }
    }
    let cnt = 0;
    let sumTime = 0;
    let sumCount = 0;
    const resTotal: { [key: string]: Hotel[] } = {};
    for (let i = 0; i < keywordHotelList.length; i++) {
        const item = keywordHotelList[i];
        const filePath = `output/result/${item.keyword}.json`;
        let isExist = false;
        if(existsSync(filePath)) {
            keywordHotelList[i].hotels = JSON.parse(readFileSync(filePath).toString());
            isExist = true;
        } 
        for (let j = 0; j < item.hotels.length; j++) {
            cnt++;
            if(isExist) continue;
            for(let k = 0; k < 5; k ++) {
                try {
                    console.log(`${total} / ${cnt}, ${item.hotels.length} / ${j} started`);
                    const start = new Date();
                    try {
                        await page.goto(item.hotels[j].url, {
                            timeout: 1000
                        });
                    } catch (error) {
    
                    }
                    await page.waitForSelector('[data-stid="content-hotel-address"]');
                    const address = await page.evaluate(() => {
                        // @ts-ignore
                        return window.document.querySelector('div[data-stid="content-hotel-address"]')?.innerText || "";
                    });
                    item.hotels[j].address = address;
                    try {
                        await page.waitForSelector('[data-stid="content-hotel-reviewsummary"] span[class=is-visually-hidden]', {
                            timeout: 1500
                        });
                        const score = await page.evaluate(() => {
                            // @ts-ignore
                            return window.document.querySelector('[data-stid="content-hotel-reviewsummary"] span[class=is-visually-hidden]').innerText || "";
                        });
                        item.hotels[j].score = score;
                    } catch (error) {
                        item.hotels[j].score = ""
                    }
                    const end = new Date();
                    const used = end.getTime() - start.getTime();
                    sumTime += used;
                    sumCount ++;
                    console.log(`${total} / ${cnt}, ${item.hotels.length} / ${j} finished in ${used}, avg: ${Math.floor(sumTime / sumCount)}, remain: ${Math.floor((total - cnt) * (sumTime / sumCount) / 1000)} s`);
                    break;
                } catch (error) {
                    try {
                        await page.reload({
                            timeout: 2000
                        })
                    } catch (error) {
                        
                    }
                }
            }
        }
        item.hotels.sort((a, b) => {
            let aa = 0, bb = 0;
            if(typeof a?.score == "string") aa = Number(a?.score?.split(' ')?.[0]);
            if(typeof b?.score == "string") bb = Number(b?.score?.split(' ')?.[0]);
            return bb - aa;
        })
        resTotal[item.keyword] = item.hotels;
        writeFileSync(filePath, JSON.stringify(item.hotels));
    }
    return resTotal;
}

const main = async () => {
    const browser = await puppeteer.launch({
        args: [
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--ignore-certificate-errors',
            '--ignore-certificate-errors-spki-list'
        ],
        // headless: "new",
        devtools: true
    });
    const page = (await browser.pages())[0];
    await page.goto("https://hotels.com", {
        waitUntil: "load",
        timeout: 0
    });
    await loadHotelList(page);
    const result = await getFullInformationFromList(page);
    writeFileSync("output/result/total.json", JSON.stringify(result));
    browser.close();
}

main();

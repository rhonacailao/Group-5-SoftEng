import "./App.css";

function App() {
  return (
    <>
      <>
        {/*----------Navigational component----------*/}
        <nav className="w-full bg-dark text-white shadow">
          <div className="mx-auto flex max-w-7xl items-center justify-between p-8">
            <a href="/" className="font-bold">
              {/*to be replaced with logo next time*/}
              <span className="text-2xl font-semibold">
                Hope <span className="text-fire">ERP</span>
              </span>
            </a>
            <div className="flex gap-6 items-center">
              <a href="/products" className="hover:underline">
                Products
              </a>
              <a href="/industries" className="hover:underline">
                Industries
              </a>
              <a href="/pricing" className="hover:underline">
                Pricing
              </a>
              <a className="px-4 py-1 bg-fire text-white rounded-md shadow-lg hover:bg-fire-light">
                Try for free
              </a>
              <a className="px-4 py-1 bg-white text-dark rounded-md shadow-lg border border-light-grey hover:bg-light-grey">
                Log in
              </a>
            </div>
          </div>
        </nav>
        {/*----------Navigational component----------*/}

        <div className="flex flex-col gap-8 p-10">
          {/*----------Typography component----------*/}
          <div>
            <span className="text-5xl font-bold leading-none">
              This is really huge text. Like,{" "}
              <span className="text-fire">really huge text. </span>
            </span>
            <h1 className="mt-8 text-2xl font-bold">
              This is a primary heading.
            </h1>
            <p className="text-md">
              This is a paragraph. Lorem ipsum dolor sit amet.
            </p>
            <h2 className="text-xl font-bold">
              This is a secondary heading. (h2)
            </h2>
            <ul className="list-disc list-inside">
              <li>List 1</li>
              <li>List 2</li>
              <li>List 3</li>
            </ul>
            <h3 className="text-lg font-bold">
              This is a tertiary heading. (h3)
            </h3>
            <p className="text-md">
              This is a paragraph. Lorem ipsum dolor sit amet. &nbsp;
              <a className="text-md text-fire underline">
                This is a hyperlink.
              </a>
            </p>
          </div>
          {/*----------Typography component----------*/}

          {/*----------Buttons component----------*/}
          <div className="flex flex-col items-center justify-center p-8 rounded-lg shadow-md border border-light-grey">
            <h1 className="text-2xl font-bold">Buttons</h1>
            <div className="flex flex-row items-center justify-center">
              <button className="m-2 px-4 py-2 bg-fire text-white rounded-md shadow-lg hover:bg-fire-light">
                Button 1 (fire)
              </button>
              <button className="m-2 px-4 py-2 bg-dark text-white rounded-md shadow-lg hover:bg-dark-grey hover:text-light">
                Button 2 (black)
              </button>
              <button className="m-2 px-4 py-2 bg-white text-dark rounded-md shadow-lg border border-light-grey hover:bg-light-grey">
                Button 3 (white)
              </button>
            </div>
          </div>
          {/*----------Buttons component----------*/}

          {/*----------Colors component----------*/}
          <div className="flex flex-col items-center justify-center p-8 rounded-lg shadow-md border border-light-grey">
            <h1 className="text-2xl font-bold">Colors</h1>
            <div className="flex flex-row items-center justify-center p-2 gap-4">
              <div className="flex items-center p-8 bg-white shadow-md rounded-md">
                #f5f5f5
              </div>
              <div className="flex items-center p-8 bg-fire shadow-md rounded-md text-white">
                #ea5c1f
              </div>
              <div className="flex items-center p-8 bg-fire-light shadow-md rounded-md">
                #ed9555
              </div>
              <div className="flex items-center p-8 bg-light-grey shadow-md rounded-md">
                #d6d7d7
              </div>
              <div className="flex items-center p-8 bg-dark-grey shadow-md rounded-md text-white">
                #4f5d75
              </div>
              <div className="flex items-center p-8 bg-dark shadow-md rounded-md text-white">
                #212431
              </div>
            </div>
          </div>
          {/*----------Colors component----------*/}

          {/*----------Text inputs component----------*/}
          <div className="flex flex-col items-center justify-center p-8 rounded-lg shadow-md border border-light-grey">
            <h1 className="text-2xl font-bold">Text Inputs</h1>
            <div className="flex flex-row items-center justify-center">
              <input
                type="text"
                placeholder="Fire"
                className="m-2 px-4 py-2 w-40 bg-white text-dark rounded-sm shadow-lg border border-fire placeholder:text-dark-grey focus:outline-none focus:ring-2 focus:ring-fire-light"
              />
              <input
                type="text"
                placeholder="White"
                className="m-2 px-4 py-2 w-40 bg-white text-dark rounded-sm shadow-lg border border-dark-grey placeholder:text-dark-grey focus:outline-none focus:ring-2 focus:ring-light-grey"
              />
              <button className="m-2 px-4 py-2 bg-fire text-white rounded-md shadow-lg hover:bg-fire-light">
                ok
              </button>
            </div>
          </div>
          {/*----------Text inputs component----------*/}

          {/*----------Table component----------*/}
          <div>
            <h1 className="mb-2 text-2xl font-bold">Table example:</h1>
            <div className="overflow-hidden rounded-md shadow-lg">
              <table className="w-full text-left">
                <thead className="bg-fire-light">
                  <tr>
                    <th className="p-2 font-semibold">Head 1</th>
                    <th className="p-2 font-semibold">Head 2</th>
                    <th className="p-2 font-semibold">Head 3</th>
                    <th className="p-2 font-semibold">Head 4</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-light-grey">
                  <tr>
                    <td className="p-2">Item 1</td>
                    <td className="p-2">Item 2</td>
                    <td className="p-2">Item 3</td>
                    <td className="p-2">Item 4</td>
                  </tr>
                  <tr>
                    <td className="p-2">Item 5</td>
                    <td className="p-2">Item 6</td>
                    <td className="p-2">Item 7</td>
                    <td className="p-2">Item 8</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          {/*----------Table component----------*/}

          {/*----------Alerts component----------*/}
          <div className="flex flex-col gap-2">
            {/*Success element*/}
            <div className="border border-green-900 bg-green-300 p-4 rounded-md text-green-800">
              <span>
                <b>Success! </b>This is a success element. If you proceed this
                success, I will succeed you.
              </span>
            </div>
            {/*Error element*/}
            <div className="border border-red-900 bg-red-300 p-4 rounded-md text-red-800">
              <span>
                <b>Error! </b>This is a Error element. If you proceed this
                Error, I will error you.
              </span>
            </div>
            {/*Warning element*/}
            <div className="border border-yellow-900 bg-yellow-300 p-4 rounded-md text-yellow-800">
              <span>
                <b>Warning! </b>This is a warning element. If you proceed this
                warning, I will warn you.
              </span>
            </div>
            {/*Pending element*/}
            <div className="border border-blue-900 bg-blue-300 p-4 rounded-md text-blue-800">
              <span>
                <b>Pending. </b>This is a pending element. If you proceed this
                pending, I will pend you.
              </span>
            </div>
          </div>
          {/*----------Alerts component----------*/}
        </div>
      </>
    </>
  );
}

export default App;
